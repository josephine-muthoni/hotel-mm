const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../..', env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Created upload directory: ${uploadDir}`);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = 'general';
    
    // Determine folder based on file type or route
    if (req.baseUrl.includes('hotels') && req.method === 'POST') {
      folder = 'hotels';
    } else if (req.baseUrl.includes('menu')) {
      folder = 'menu';
    } else if (req.baseUrl.includes('users')) {
      folder = 'users';
    }
    
    const dir = path.join(uploadDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
    
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = env.ALLOWED_FILE_TYPES;
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 5, // Max number of files
  },
  fileFilter: fileFilter,
});

/**
 * Middleware for single file upload
 */
exports.uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 5MB',
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files',
            });
          }
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  };
};

/**
 * Middleware for multiple file upload
 */
exports.uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  };
};

/**
 * Process uploaded file and return URL
 */
exports.processFile = (req, folder = 'general') => {
  if (!req.file) return null;
  
  const fileUrl = `/uploads/${folder}/${req.file.filename}`;
  
  // Return file info
  return {
    url: fileUrl,
    path: req.file.path,
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  };
};

/**
 * Process multiple uploaded files
 */
exports.processFiles = (req, folder = 'general') => {
  if (!req.files || req.files.length === 0) return [];
  
  return req.files.map(file => ({
    url: `/uploads/${folder}/${file.filename}`,
    path: file.path,
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  }));
};

/**
 * Delete file from disk
 */
exports.deleteFile = (filePath) => {
  if (!filePath) return;
  
  const fullPath = path.join(__dirname, '../..', filePath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`🗑️  Deleted file: ${fullPath}`);
    return true;
  }
  
  return false;
};

/**
 * Delete multiple files
 */
exports.deleteFiles = (filePaths) => {
  if (!Array.isArray(filePaths)) return;
  
  filePaths.forEach(filePath => {
    if (filePath) {
      this.deleteFile(filePath);
    }
  });
};