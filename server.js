const f = require('./functions/functions');
const express = require('express');
const bodyParser = require('body-parser');
const HOST = '0.0.0.0';
const PORT = 8080;
const log = require('log-to-file');
const argon2 = require('argon2');
const sq = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const KEY = require('./functions/key');

var db = new sq.Database(__dirname + '/db/users.db3');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('views', __dirname + '/public');
app.engine('html', require('ejs').renderFile);
app.use('/public', express.static('public'));

app.get('/', (req, res) => {
	res.render('index.html', {
		"page": "home",
	});
});

app.get('/doc', (req, res) => {
	res.render('doc.html', {
		"page": "doc",
	});
});

app.post('/ping', (req, res) => {
	res.json({
		"code": res.statusCode,
		"message": req.statusMessage
	});
});

app.post('/signup', (req, res) => {
	var username = req.body.username;
	var email = req.body.email;
	var rawpass = req.body.password;

	if (!username || !email || !rawpass) {
		res.status(422).json({
			"code": res.statusCode,
			"message": "Missing argument"
		});
		log('IP : ' + req.ip + ' - return code : ' + res.statusCode + ' - on url ' + req.url + ' - with method ' + req.method, 'logs/server.log');
		return;
	};

	db.get("SELECT user_id FROM users WHERE user_mail = '" + email + "'", async function (err, user) {
		if (user == null) {
			var pass = await argon2.hash(rawpass);
			db.exec("INSERT INTO users (user_name, user_pass, user_mail) VALUES ('" + username + "','" + pass + "','" + email + "')");
			res.json({
				"code": res.statusCode,
				"message": req.statusMessage
			});
			return;
		} else {
			res.status(401).json({
				"code": res.statusCode,
				"message": "Email as already exist in DB"
			});
			log('IP : ' + req.ip + ' - return code : ' + res.statusCode + ' - on url ' + req.url + ' - with method ' + req.method, 'logs/server.log');
			return;
		}
	});
});

app.post('/login', (req, res) => {
	var email = req.body.email.toString();
	var password = req.body.password.toString();

	if (!email || !password) {
		res.status(422).json({
			"code": res.statusCode,
			"message": "Missing argument"
		});
		log('IP : ' + req.ip + ' - return code : ' + res.statusCode + ' - on url ' + req.url + ' - with method ' + req.method, 'logs/server.log');
		return
	};

	db.get("SELECT * FROM users WHERE user_mail='" + email + "'", async function (err, user) {
		if (user != null) {
			if (await argon2.verify(user.user_pass, password)) {
				var user = user;
				var token = jwt.sign({ "user": user }, KEY.getKey());
				res.json({
					"code": res.statusCode,
					"message": req.statusMessage,
					"data": token
				});
				f.updateTimeLog(db, user.user_id);
			} else {
				res.status(401).json({
					"code": res.statusCode,
					"message": "Incorect password"
				});
				log('IP : ' + req.ip + ' - return code : ' + res.statusCode + ' - on url ' + req.url + ' - with method ' + req.method, 'logs/server.log');
			}
		} else {
			res.status(401).json({
				"code": res.statusCode,
				"message": "Incorect email"
			});
			log('IP : ' + req.ip + ' - return code : ' + res.statusCode + ' - on url ' + req.url + ' - with method ' + req.method, 'logs/server.log');
		}
	});
});

app.post('/save', f.validateToken, (req, res) => {
	jwt.verify(req.token, KEY.getKey(), (err, authData) => {
		if (err) {
			res.status(403).json({
				"code": res.statusCode,
				"message": "Error append"
			});
		} else {
			res.json({
				code: res.statusCode,
				ip: req.ip,
				authData,
				message: req.statusMessage
			});
		}
	});
});

app.listen(PORT, HOST, () => console.log('Running on http://172.18.1.1:8080'));
