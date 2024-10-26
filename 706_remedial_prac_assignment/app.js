const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

// MongoDB Connection
const client = new MongoClient('mongodb://localhost:27017/');
let db;

client.connect().then(() => {
  db = client.db('movies_db');
});

// File Upload Configuration
const upload = multer({ dest: 'uploads/' }); // Temporary storage

// Middleware for Authentication Check
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Login Route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.collection('users').findOne({ username, password }, (err, user) => {
    if (user) {
      req.session.user = user;
      res.redirect('/movies');
    } else {
      res.send('Invalid login');
    }
  });
});

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Insert Movie Details
app.get('/add-movie', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'addovie.html'));
});

app.post('/addmovie', upload.single('image'), (req, res) => {
  const { name, director, producer, release_date } = req.body;
  const image = req.file ? req.file.filename : null;
  db.collection('movies').insertOne({ name, director, producer, release_date: new Date(release_date), image }, (err, result) => {
    if (err) throw err;
    res.redirect('/movies');
  });
});

// Multiple Image Upload for Movie
app.post('/add-movie-images/:movieId', upload.array('images', 5), (req, res) => {
  const { movieId } = req.params;
  const images = req.files.map(file => ({ movie_id: ObjectId(movieId), image: file.filename }));

  db.collection('movie_images').insertMany(images, (err, result) => {
    if (err) throw err;
    res.redirect('/movies');
  });
});

// Display Movies with Details
app.get('/movies', isAuthenticated, (req, res) => {
  db.collection('movies').aggregate([
    {
      $lookup: {
        from: 'movie_images',
        localField: '_id',
        foreignField: 'movie_id',
        as: 'images'
      }
    },
    {
      $lookup: {
        from: 'movie_screens',
        localField: '_id',
        foreignField: 'movie_id',
        as: 'screens'
      }
    },
    {
      $lookup: {
        from: 'screens',
        localField: 'screens.screen_id',
        foreignField: '_id',
        as: 'screen_details'
      }
    }
  ]).toArray((err, movies) => {
    if (err) throw err;
    res.json(movies); // Display results as JSON (for simplicity)
  });
});

// Delete Movie
app.post('/delete-movie/:movieId', isAuthenticated, (req, res) => {
  const { movieId } = req.params;
  db.collection('movies').deleteOne({ _id: ObjectId(movieId) }, (err, result) => {
    if (err) throw err;
    res.redirect('/movies');
  });
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
