const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const middleware = require('./middleware');
const bodyParser = require('body-parser');
const port = 3000;
app.use(session({
  secret: '_ECE461_Phase2_*',
  resave: true,
  saveUninitialized: false
}))

const loginRoutes = require('./routes/loginRoutes');
const authRoutes = require('./routes/authRoutes');
app.set('view engine', 'ejs')
app.set('views', 'views')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))

app.use('/login', loginRoutes);
app.use('/authenticate', authRoutes);

app.get('/', middleware.requireLogin, (req, res) => {
  const payload = {
    userLoggedIn: req.session.user,
    pageTitle: 'Home'
  }
  res.status(200).render('home', { payload: payload })
});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});