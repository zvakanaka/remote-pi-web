const fs = require('fs')

module.exports = {
  read: (fileName, encoding = 'utf8') => {
   return new Promise((resolve, reject) => {
     fs.readFile(fileName, encoding, (err, data) => {
       if (err) throw err;
       resolve(data.toString());
      });
    })
  }
};
