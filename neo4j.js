const bcrypt = require("bcrypt");
const e = require("express");
const { v4: uuidv4 } = require("uuid");
const queries = require("./queries");
module.exports = (neo4j) => {
  function groupBy(array, property) {
    var hash = {};
    for (var i = 0; i < array.length; i++) {
      if (!hash[array[i][property]]) hash[array[i][property]] = [];
      hash[array[i][property]].push(array[i]);
    }
    return hash;
  }
  function dynamicSort(property) {
    var sortOrder = 1;
    if (property[0] === "-") {
      sortOrder = -1;
      property = property.substr(1);
    }
    return function (a, b) {
      var result =
        a[property] < b[property] ? -1 : a[property] > b[property] ? 1 : 0;
      return result * sortOrder;
    };
  }
  function findLastIndex(array, searchKey, searchValue) {
    var index = array
      .slice()
      .reverse()
      .findIndex((x) => x[searchKey] === searchValue);
    var count = array.length - 1;
    var finalIndex = index >= 0 ? count - index : index;
    return finalIndex;
  }
  var driver = neo4j.driver(
    "neo4j://localhost",
    neo4j.auth.basic("neo4j", "Suki1329i")
  );
  driver.verifyConnectivity().then((msg) => {
    console.log(msg);
  });
  let getSession = () => {
    return driver.session();
  };
  return {
    registerUser: async (userData) => {
      if (!(userData.email && userData.nickname && userData.password)) {
        throw new Error("Invalid Data Received");
      }
      let hashedPassword = await bcrypt.hash(userData.password, 12);
      let session = getSession();
      return session
        .run(queries.registerQuery, {
          id: uuidv4(),
          email: userData.email,
          nickname: userData.nickname,
          password: hashedPassword,
          time: Date.now(),
        })
        .then((result) => {
          session.close();
          return {
            id: result.records[0].get("id"),
            email: result.records[0].get("email"),
            username: result.records[0].get("username"),
          };
        })
        .catch((err) => {
          session.close();
          throw err;
        });
    },
    fetchUser: async (userData) => {
      if (!userData.email) {
        throw new Error("Invalid Data");
      }
      let session = getSession();
      return session
        .run(queries.findGameUserQuery, {
          email: userData.email,
        })
        .then((result) => {
          session.close();
          if (!result.records || !result.records.length > 0) {
            return Promise.reject({
              err: "invalid email",
            });
          }
          return {
            id: result.records[0].get("id"),
            email: result.records[0].get("email"),
            username: result.records[0].get("username"),
            password: result.records[0].get("password"),
          };
        })
        .catch((error) => {
          session.close();
          throw error;
        });
    },
    fetchAllChapters: async (data) => {
      let session = getSession();
      return session
        .run(queries.getAllChaptersQuery, data)
        .then((result) => {
          session.close();
          if (!result.records || !result.records.length > 0) {
            return Promise.reject({
              err: "invalid data",
            });
          }
          let getStatus = (status) => {
            if (status) {
              if (status === "IsCurrentlyPlaying") {
                return "CURRENT";
              }
              if (status === "HasCompleted") {
                return "COMPLETED";
              }
              return "UNKNOWN";
            } else {
              return "LOCKED";
            }
          };
          let data = result.records.map((record) => {
            return {
              id: record.get("chapterID"),
              title: record.get("chapterTitle"),
              description: record.get("chapterDescription"),
              order: record.get("tag").low,
              language: record.get("language"),
              status: getStatus(record.get("status")),
            };
          });
          let responseData = [];
          let hash = groupBy(data, "language");
          for (var key of Object.keys(hash)) {
            let _temp = hash[key].sort(dynamicSort("tag"));
            if (hash[key].some((obj) => obj.status === "LOCKED")) {
              if (hash[key].every((obj) => obj.status === "LOCKED")) {
                _temp[0].status = "UNLOCKED";
                responseData.push(..._temp);
                continue;
              } else {
                let currentIndex = findLastIndex(_temp, "status", "CURRENT");
                if (currentIndex !== -1) {
                  responseData.push(..._temp);
                  continue;
                }
                let completedIndex = findLastIndex(
                  _temp,
                  "status",
                  "COMPLETED"
                );
                _temp[completedIndex + 1].status = "UNLOCKED";
                responseData.push(..._temp);
                continue;
              }
            } else {
              responseData.push(..._temp);
            }
          }
          return {
            data: responseData,
          };
        })
        .catch((error) => {
          session.close();
          throw error;
        });
    },
    startChapter: async (data) => {
      if (!data.chapterId) {
        throw new Error("Invalid Chapter Id");
      }
      if (!data.userId) {
        throw new Error("Invalid userId");
      }
      let session = getSession();
      return session
        .run(queries.startChapterQuery, data)
        .then((result) => {
          session.close();
          if (!result.records || !result.records.length > 0) {
            return Promise.reject({
              err: "invalid data",
            });
          }
          let data = result.records.map((record) => {
            return {
              id: record.get("gateId"),
              question: record.get("question"),
              key: record.get("gateKey"),
              chapterId: record.get("chapterId"),
              exp: record.get("exp").low,
              tag: record.get("gateTag"),
              isCheckPoint: record.get("isCheckPoint"),
            };
          });
          return {
            data: data,
          };
        })
        .catch((error) => {
          session.close();
          throw error;
        });
    },
    setCheckPoint: async (data) => {
      if (!data.gateId || !data.userId || !data.exp) {
        throw new Error("Invalid data");
      }
      let session = getSession();
      return session
        .run(queries.setCheckPointQuery, data)
        .then((result) => {
          session.close();
          return true;
        })
        .catch((err) => {
          session.close();
          throw err;
        });
    },
    findGate: async (data) => {
      if (!data.gateId) {
        throw new Error("invalid data");
      }
      let session = getSession();
      return session
        .run(queries.findGateByID, data)
        .then((result) => {
          session.close();
          if (!result.records || !result.records.length > 0) {
            return Promise.reject({
              err: "invalid data",
            });
          }
          return {
            id: result.records[0].get("id"),
            exp: result.records[0].get("exp").low,
            answer: result.records[0].get("answer"),
          };
        })
        .catch((err) => {
          session.close();
          throw err;
        });
    },
  };
};
