const express = require("express");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const neo4j = require("./neo4j")(require("neo4j-driver"));
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const compiler = require("./UniversalCompiler")();
var cors = require("cors");
var app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.send("hello");
});

app.post("/unlock/gate/:gateId/:key", (req, res) => {
  jwt.verify(req.params.key, process.env.TOKEN_SALT, async (err, decoded) => {
    if (err) {
      res.status(403).send({
        error: "unauthorised api key",
      });
      return;
    }
    let gateId = req.params.gateId;
    let data = req.body;
    try {
      let result = await Promise.all([
        neo4j.findGate({
          gateId: gateId,
        }),
        compiler.compile(data.code, data.language),
      ]);
      let gate = result[0];
      let output = result[1];
      if (gate.answer === output) {
        neo4j
          .setCheckPoint({
            exp: gate.exp,
            gateId: gate.id,
            userId: decoded.id,
          })
          .then(() => {
            res.send(true);
          })
          .catch((err) => {
            res.status(500).send({
              err: err,
            });
          });
      } else {
        res.send(false);
      }
    } catch (e) {
      res.status(500).send({
        err: e,
      });
    }
  });
});

app.get("/:level", (req, res) => {
  level = req.params.level;
  if (level) {
    if (levels[level]) {
      res.send(levels[level]);
    } else {
      res.status(500).send({ error: "level not found" });
    }
  }
});

app.post("/auth/register", (req, res) => {
  let userData = req.body;
  neo4j
    .registerUser(userData)
    .then((result) => {
      jwt.sign(result, process.env.TOKEN_SALT, (err, token) => {
        if (err) {
          console.log(err);
          res.status(412).send({
            error: err,
          });
          return;
        }
        res.send({
          ...result,
          token: token,
        });
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(412).send({
        error: err,
      });
    });
});

app.post("/auth/login", (req, res) => {
  let userCredentials = req.body;
  if (!userCredentials.password) {
    res.status(403).send({
      error: "Invalid password or username",
    });
  }
  neo4j
    .fetchUser(userCredentials)
    .then(async (result) => {
      const matched = await bcrypt.compare(
        userCredentials.password,
        result.password
      );
      if (matched) {
        delete result.password;
        jwt.sign(result, process.env.TOKEN_SALT, (err, token) => {
          if (err) {
            console.log(err);
            res.status(500).send({
              error: err,
            });
            return;
          }
          res.send({
            ...result,
            token: token,
          });
        });
      } else {
        res.status(403).send({ error: "Invalid email or password" });
      }
    })
    .catch((err) => res.status(412).send(err));
});

app.get("/chapter/all/:key", (req, res) => {
  if (!req.params.key) {
    res.status(403).send({
      error: "unauthorised api key",
    });
    return;
  }
  jwt.verify(req.params.key, process.env.TOKEN_SALT, function (err, decoded) {
    if (err) {
      res.status(403).send({
        error: "unauthorised api key",
      });
      return;
    }
    neo4j
      .fetchAllChapters({
        id: decoded.id,
      })
      .then((result) => {
        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({
          err: "pls try again later, server error",
        });
      });
  });
});

app.get("/:key/chapter/:id/gates/getAll", (req, res) => {
  if (!req.params.key) {
    res.status(403).send({
      error: "unauthorised api key",
    });
    return;
  }
  if (!req.params.id) {
    res.status(404).send({
      error: "unknown chapter id",
    });
  }
  jwt.verify(req.params.key, process.env.TOKEN_SALT, function (err, decoded) {
    if (err) {
      res.status(403).send({
        error: "unauthorised api key",
      });
      return;
    }
    neo4j
      .startChapter({
        userId: decoded.id,
        chapterId: req.params.id,
      })
      .then((result) => {
        res.send(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({
          err: "pls try again later, server error",
        });
      });
  });
});

app.listen(5000, () => {
  console.log("Server started");
});
