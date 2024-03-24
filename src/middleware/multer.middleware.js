import multer from "multer";


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")  // storing desitination in server
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // file name defining
    }
  })
  
export  const upload = multer({ storage:storage})