module.exports = () => {
  var fs = require("fs");
  const util = require("util");
  const exec = util.promisify(require("child_process").exec);
  const readdir = util.promisify(fs.readdir);
  const { v4: uuidv4 } = require("uuid");

  var store = {
    python: (file) => `python3 ${file.name}.${file.extension}`,
    clang: (file) =>
      `gcc ${file.name}.${file.extension} -o ${file.name} && ./${file.name}`,
    cpp: (file) =>
      `g++ ${file.name}.${file.extension} -o ${file.name} && ./${file.name}`,
  };

  let getFileExtension = (filename) => {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
  };

  let getFileNameWithOutExtension = (filename) => {
    return filename.substring(0, filename.lastIndexOf(".")) || filename;
  };

  let extensions = {
    python: "py",
    clang: "c",
    cpp: "cpp",
  };

  let cleanUpFiles = async (fname) => {
    try {
      let files = await readdir(__dirname + "/");
      files.forEach((file) => {
        if (getFileNameWithOutExtension(file) == fname) {
          fs.unlink(file, function (err) {
            if (err) throw err;
          });
        }
      });
    } catch (e) {
      throw err;
    }
  };

  let createFile = async (filename, extension, content) => {
    fs.appendFile(`${filename}.${extension}`, content, (err) => {
      if (err) {
        fs.unlink(`${filename}.${extension}`, (err) => {
          console.log(err);
        });
        return Promise.reject(err);
      }
    });
    return Promise.resolve();
  };

  return {
    compile: async (code, language) => {
      let fname = uuidv4();
      let extension = extensions[language];
      return createFile(fname, extension, code)
        .then(async () => {
          let execStatement = store[language]({
            name: fname,
            extension: extension,
          });
          try {
            const { stdout, stderr } = await exec(execStatement);
            cleanUpFiles(fname);
            if (stderr) {
              return Promise.reject(stderr);
            }
            if (stdout) {
              return stdout;
            }
          } catch (e) {
            return Promise.reject(e);
          }
        })
        .catch((err) => {
          cleanUpFiles(fname);
          throw err;
        });
    },
  };
};
