const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const socketioJwt = require('socketio-jwt');
const CryptoJS = require("crypto-js");

const Server = require('./Server');
const UserUtils = require('./UserUtils');

const JWT_SECRET = 'logthecatfish';

const app = express();
app.get('/', (req, res) => {
    res.sendFile(path.resolve('public/index.html'));
});

// 加载静态文件
app.get('/*', (req, res) => {
    const file = req.params[0];
    // console.log('\t :: Express :: file requested : ' + file);
    res.sendFile(path.resolve('public/' + file));
});

// 用户登录
app.use(require('body-parser').json());
app.post('/login', (req, res) => {
    let bytes = CryptoJS.AES.decrypt(req.body.data, JWT_SECRET);
    let data = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    // if (Date.now() - data.timestamp > 1000) {
    //     res.json({ code: 2, message: "登录超时，请重试！" });
    //     return;
    // }
    let { username, password } = data;
    UserUtils.validate(username, password).then(() => {
        // 判断重复登录
        // 这里是异步 可能出错
        if (gameSvr.onlineUsers.has(username)) {
            res.json({ code: 3, message: "不能重复登录！"});
            return;
        }
        let token = loginGameServer(username, password);
        res.json({ code: 0, token: token, username: username });
    }).catch(() => {
        res.json({ code: 1, message: "用户名与密码不匹配！"});
    });
});

// 用户注册
app.post('/register', (req, res) => {
    let bytes  = CryptoJS.AES.decrypt(req.body.data, JWT_SECRET);
    let { username, password } = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

    UserUtils.new(username, password).then(() => {
        let token = loginGameServer(username, password);
        res.json({ code: 0, token: token, username: username });
    }).catch((err) => {
        res.json({ code: 100, message: err.message });
    });
});

// type express.Server (http.Server)
const server = app.listen(3000, 'localhost', () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

// socket.io server
const io = require('socket.io')(server);

io.set('authorization', socketioJwt.authorize({
    secret: JWT_SECRET,
    handshake: true
}));

// 类似app.use 注册中间件
io.use(function (socket, next) {
    // 根据保存的 token-username对 选出username
    console.log('app.js io.use', socket.id);
    socket.username = tokenUserMap[socket.handshake.query.token];
    return next();
});

const gameSvr = new Server(io);
io.on('connection', (socket) => {
    console.log('app.js io.onConnection', socket.username);
    gameSvr.addClient(socket);
});

// 对每个登录的user记录一个token
const tokenUserMap = {};
function loginGameServer(username, password) {
    let token = jwt.sign({username: username, password: password}, JWT_SECRET, { expiresIn: '1m' });
    tokenUserMap[token] = username;
    return token;
}


// js helpers
Array.prototype.indexOf = function(val) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === val) return i;
    }
    return -1;
};

Array.prototype.remove = function(val) {
    var index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
};

// meta.js es6 ployfill
Object.defineProperty(Object.prototype, "class", {
    get: function() {
        return Object.getPrototypeOf(this).constructor;
    }
});