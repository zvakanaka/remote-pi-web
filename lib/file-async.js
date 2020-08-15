const fs = require('fs')

module.exports = {
  read: (fileName) => {
   return new Promise((resolve, reject) => {
     fs.readFile(fileName, (err, data) => {
       if (err) throw err;
       resolve(data.toString());
      });
    })
  }
};
