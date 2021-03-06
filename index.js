//imports express ( a node.js)framework with middlware module packages  body parser, uuid and morgan
const express = require("express"),
  bodyParser = require("body-parser"),
  uuid = require("uuid"); //automatically creates and assigns unique ids to new users

const morgan = require("morgan");
const app = express(); //sets  express’s functionality to a variable
//require Mongoose package and models.js files
const mongoose = require('mongoose');
const Models = require('./models.js');
//refering to the model names in models.js file
const Movies = Models.Movie;
const Users = Models.User;


// integration between my REST API and my database
// allowing Mongoose to connect to the database to perform CRUD on the documents it contains from within my REST API

//connecting to MongoDB locally (on my PC)
//mongoose.connect('mongodb://localhost:27017/myFlixDB', { useNewUrlParser: true, useUnifiedTopology: true });

//connecting to MongoDB (via link copied from MongoDB Atlas)

//Config Vars in Heroku (so that the password is not shown in the code) (as it was in the link above...)
mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });


//invokes the middleware module body-parser.
//it allows you to read the “body” of HTTP requests within your request handlers simply by using the code req.body.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//require CORS (Cross-Origin Resource Sharing)
const cors = require('cors');
//app.use(cors());

//create a list of allowed origins
let allowedOrigins = [
  'http://localhost:8080',
  'http://testsite.com',
  'http://localhost:1234',
  'http://localhost:4200',
  'https://nine-chairs.github.io',
  'https://listapeli.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) { // If a specific origin isn’t found on the list of allowed origins
      let message = 'The CORS policy for this application doesn’t allow access from origin ' + origin;
      return callback(new Error(message), false);
    }
    return callback(null, true);
  }
}));

//import auth.js into the project
let auth = require('./auth')(app); //passing the "app" argument ensures that Express is available in my "auth.js" file as well


//import the "passport.js" file
//require the Passport module
const passport = require('passport');
require('./passport');

//require express validator (to validate inputs from user)
const { check, validationResult } = require('express-validator');

//invokes middleware function with "common" parameters using the default format
/**
 * Logs basic request data in terminal using Morgan middleware library
 */
app.use(morgan("common"));



//-----------------------------------------------------------//


//defining http message codes
const { INTERNAL_SERVER_ERROR, NOT_FOUND, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY, OK, CREATED } = {
  "INTERNAL_SERVER_ERROR": 500,
  "NOT_FOUND": 404,
  "BAD_REQUEST": 400,
  "UNAUTHORIZED": 401,
  "FORBIDDEN": 403,
  "UNPROCESSABLE_ENTITY": 422,
  "OK": 200,
  "CREATED": 201
}


//-----------------------------------------------------------//


// --ENDPOINT DEFINITIONS--


// *Test* Get welcome text
/**
 * GET: Returns welcome message for '/' request URL
 * @returns Welcome message
 */
app.get("/", (req, res) => {
  res.send("Welcome to myFlix app");
});



// 1. Return a list of ALL movies to the user
// *will require a JWT token from the client
/**
 * GET: Returns a list of ALL movies to the user
 * Request body: Bearer token
 * @returns array of movie objects
 * @requires passport
 */
app.get("/movies", passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(OK).json(movies);
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send("Error: " + err);
    });
});



// 2. Return data about a single movie by title to the user
// *will require a JWT token from the client
/**
 * GET: Returns data (description, genre, director, image URL) about a single movie by title to the user
 * Request body: Bearer token
 * @param Title
 * @returns movie object
 * @requires passport
 */
app.get("/movies/:Title", passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ Title: req.params.Title })
    .then((movie) => {
      if (movie) {
        res.json(movie)
      } else {
        res.status(NOT_FOUND).send("Movie not found");
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send("Error: " + err);
    });
});



// 3. Return data about a genre by title
/**
 * GET: Returns data about a genre (description) by name (e.g., “Drama”)
 * Request body: Bearer token
 * @param Name (of genre)
 * @returns genre object
 * @requires passport
 */
app.get("/genre/:Name", passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ "Genre.Name": req.params.Name })
    .then((movie) => {
      res.json(movie.Genre);
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send("Error: " + err);
    });
});



// 4. Return data about a director by name
/**
 * GET: Returns data about a director (bio, birth year, death year) by name
 * Request body: Bearer token
 * @param Name (of director)
 * @returns director object
 * @requires passport
 */
app.get("/director/:Name", passport.authenticate('jwt', { session: false }), (req, res) => {
  Movies.findOne({ "Director.Name": req.params.Name })
    .then((movie) => {
      if (movie) {
        res.json(movie.Director);
      } else {
        res.status(NOT_FOUND).send("Director not found");
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send("Error: " + err);
    });
});



// 5. Allow new users to register
// -- We’ll expect JSON in this format
/**
 * POST: Allows new users to register; Username, Password & Email are required fields!
 * Request body: Bearer token, JSON with user information
 * @returns user object
 */
app.post('/users',
  // Validation logic here for request
  //you can either use a chain of methods like .not().isEmpty()
  //which means "opposite of isEmpty" in plain english "is not empty"
  //or use .isLength({min: 5}) which means
  //minimum value of 5 characters are only allowed
  [
    check('Username', 'Username is required').isLength({ min: 5 }),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid').isEmail()
  ], (req, res) => {

    // check the validation object for errors
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(UNPROCESSABLE_ENTITY).json({ errors: errors.array() });
    }

    let hashedPassword = Users.hashPassword(req.body.Password);
    Users.findOne({ Username: req.body.Username }) // Search to see if a user with the requested username already exists
      .then((user) => {
        if (user) {
          //If the user is found, send a response that it already exists
          return res.status(BAD_REQUEST).send(req.body.Username + ' already exists');
        } else {
          Users
            .create({
              Username: req.body.Username,
              Password: hashedPassword,
              Email: req.body.Email,
              Birthday: req.body.Birthday
            })
            .then((user) => { res.status(CREATED).json(user) })
            .catch((error) => {
              console.error(error);
              res.status(INTERNAL_SERVER_ERROR).send('Error: ' + error);
            });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(INTERNAL_SERVER_ERROR).send('Error: ' + error);
      });
  });

// *Test* Get all users
/** 
 * GET: Returns a list of ALL users
 * Request body: Bearer token
 * @returns array of user objects
 * @requires passport
 */
app.get("/users", passport.authenticate('jwt', { session: false }), function (req, res) {
  Users.find()
    .then(function (users) {
      res.status(CREATED).json(users);
    })
    .catch(function (err) {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send("Error: " + err);
    });
});

// *Test* Get a user by username
/**
 * GET: Returns data on a single user (user object) by username
 * Request body: Bearer token
 * @param Username
 * @returns user object
 * @requires passport
 */
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then((user) => {
      res.json(user);
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send('Error: ' + err);
    });
});



// 6. Allow users to update their info
// -- We’ll expect JSON in this format
// !! ATTENTION !! -- Make sure that the returned object (json) doesn't contain sensitive data such as passwords, etc....
/**
 * PUT: Allow users to update their user info (find by username)
 * Request body: Bearer token, updated user info
 * @param Username
 * @returns user object with updates
 * @requires passport
 */
app.put('/users/:Username', passport.authenticate('jwt', { session: false }),
  // Validation logic
  [
    check('Username', 'Username is required (min 3 characters).').isLength({ min: 3 }),
    check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric()
  ], (req, res) => {
    // Check validation object for errors
    let errors = validationResult(req);
    let hashedPassword = undefined;

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    // If Password is given in request body, create hashedPassword from given Password
    if (req.body.hasOwnProperty('Password')) {
      hashedPassword = Users.hashPassword(req.body.Password);
    }

    Users.findOneAndUpdate({ Username: req.params.Username }, // Find user by existing username
      {
        $set: { // Info from request body that can be updated
          Username: req.body.Username,
          Password: hashedPassword, // Store only hashed password
          Email: req.body.Email,
          Birthday: req.body.Birthday
        }
      },
      { new: true }) // Return the updated document
      .then((updatedUser) => {
        res.json(updatedUser); // Return json object of updatedUser
      })
      .catch((err) => {
        console.error(err);
        res.status(INTERNAL_SERVER_ERROR).send('Error: ' + err);
      });
  });



// 7. Allow users to add a movie to their list of favorites
/**
 * POST: Allows users to add a movie to their list of favorites
 * Request body: Bearer token
 * @param Username
 * @param MovieID
 * @returns user object
 * @requires passport
 */
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, {
    $push: { FavoriteMovies: req.params.MovieID }
  },
    { new: true }, // This line makes sure that the updated document is returned
    (err, updatedUser) => {
      if (err) {
        console.error(err);
        res.status(INTERNAL_SERVER_ERROR).send('Error: ' + err);
      } else {
        res.json(updatedUser);
      }
    });
});



// 8. Allow users to remove a movie from their list of favorites
/**
 * DELETE: Allows users to remove a movie from their list of favorites
 * Request body: Bearer token
 * @param Username
 * @param MovieID
 * @returns user object
 * @requires passport
 */
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndUpdate({ Username: req.params.Username }, {
    $pull: { FavoriteMovies: req.params.MovieID }
  },
    { new: true }, // This line makes sure that the updated document is returned
    (err, updatedUser) => {
      if (err) {
        console.error(err);
        res.status(INTERNAL_SERVER_ERROR).send('Error: ' + err);
      } else {
        res.json(updatedUser);
      }
    });
});



// 9. Allows users to get a list of their favorite movies
/**
 * GET: Returns a list of favorite movies from the user
 * Request body: Bearer token
 * @param Username
 * @returns array of favorite movies
 * @requires passport
 */
app.get('/users/:Username/movies', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOne({ Username: req.params.Username })
    .then((user) => {
      if (user) { // If a user with the corresponding username was found, return user info
        res.status(OK).json(user.FavoriteMovies);
      } else {
        res.status(BAD_REQUEST).send('Could not find favorite movies for this user');
      };
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('Error: ' + err);
    });
});



// 10. Allow existing users to deregister
/**
 * DELETE: Allows existing users to deregister
 * Request body: Bearer token
 * @param Username
 * @returns success message
 * @requires passport
 */
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
  Users.findOneAndRemove({ Username: req.params.Username })
    .then((user) => {
      if (!user) {
        res.status(BAD_REQUEST).send(req.params.Username + ' was not found');
      } else {
        res.status(OK).send(req.params.Username + ' was deleted.');
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(INTERNAL_SERVER_ERROR).send('Error: ' + err);
    });
});


// -- END OF ENDPOINT DEFINITIONS--


//--------------------------------------------------------------------//


//--MIDDLEWARE FUNCTIONS


//GET request to display message in the browser upon entering "localhost:8080" in the browser
app.get("/", (req, res) => {
  res.send("Welcome to my top 10 movies");
});

// !!
// SETTING UP THE SERVER
/**
 * defines port, listening to port 8080
 */
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log('Listening on Port ' + port);
});

//express function that automatically routes all requests for static files to their corresponding files in the "public" folder
/**
 * Serves static content for the app from the 'public' directory
 */
app.use(express.static("public"));

//Morgan middleware library that logs all request
let myLogger = (req, res, next) => {
  console.log(req.url);
  next();
};
app.use(myLogger);

//setting the error handler in express(always put it last in line)
/**
 * handles errors
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(INTERNAL_SERVER_ERROR).send("Error!");
});
