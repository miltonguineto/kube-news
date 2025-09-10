const express = require('express');
const app = express();
const models = require('./models/post')
const bodyParser = require('body-parser')
const promBundle = require("express-prom-bundle");
const config = require('./system-life');
const middlewares = require('./middleware')
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const metricsMiddleware = promBundle({
    includeMethod: true, 
    includePath: true, 
    includeStatusCode: true, 
    includeUp: true,
    promClient: {
        collectDefaultMetrics: {
        }
      }
});

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health check endpoints
        return req.path === '/health' || req.path === '/ready';
    }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 API requests per windowMs
    message: 'Too many API requests from this IP, please try again later.',
});

const postLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 post requests per windowMs
    message: 'Too many post requests from this IP, please try again later.',
});

app.use(helmet());
app.use(limiter);
app.use('/api/', apiLimiter);
app.use('/post', postLimiter);
app.use(middlewares.countRequests)
app.use(metricsMiddleware)
app.use(config.middlewares.healthMid);
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }))
app.use(bodyParser.json({ limit: '10mb' }))
app.set('view engine', 'ejs');
app.use('/', config.routers);


app.get('/post', (req, res) => {
    res.render('edit-news', {post: {title: "", content: "", summary: ""}, valido: true});
});

app.post('/post', async (req, res) => {
    try {
        let valid = true;

        if (!req.body.title || !req.body.resumo || !req.body.description) {
            valid = false;
        } else if ((req.body.title.length !== 0 && req.body.title.length <= 30) && 
            (req.body.resumo.length !== 0 && req.body.resumo.length <= 50) &&
            (req.body.description.length !== 0 && req.body.description.length <= 2000)) {
            valid = true;
        } else {
            valid = false;
        }

        if (valid) {
            await models.Post.create({title: req.body.title, content: req.body.description, summary: req.body.resumo, publishDate: Date.now()});
            res.redirect('/');
        } else {
            res.render('edit-news', {post: {title: req.body.title || '', content: req.body.description || '', summary: req.body.resumo || ''}, valido: false});
        }
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/api/post', async (req, res) => {
    try {
        if (!req.body.artigos || !Array.isArray(req.body.artigos)) {
            return res.status(400).json({error: 'artigos must be an array'});
        }

        if (req.body.artigos.length === 0) {
            return res.status(400).json({error: 'artigos array cannot be empty'});
        }

        if (req.body.artigos.length > 100) {
            return res.status(400).json({error: 'Maximum 100 articles allowed per request'});
        }

        const validatedArticles = [];
        
        for (const item of req.body.artigos) {
            // Validate each article
            if (!item.title || !item.description || !item.resumo) {
                return res.status(400).json({error: 'Each article must have title, description, and resumo'});
            }

            if (typeof item.title !== 'string' || item.title.length === 0 || item.title.length > 30) {
                return res.status(400).json({error: 'Title must be a string between 1 and 30 characters'});
            }

            if (typeof item.resumo !== 'string' || item.resumo.length === 0 || item.resumo.length > 50) {
                return res.status(400).json({error: 'Summary must be a string between 1 and 50 characters'});
            }

            if (typeof item.description !== 'string' || item.description.length === 0 || item.description.length > 2000) {
                return res.status(400).json({error: 'Description must be a string between 1 and 2000 characters'});
            }

            validatedArticles.push({
                title: item.title,
                content: item.description,
                summary: item.resumo,
                publishDate: Date.now()
            });
        }

        // Create all articles
        for (const article of validatedArticles) {
            await models.Post.create(article);
        }

        res.json({message: `Successfully created ${validatedArticles.length} articles`});
    } catch (error) {
        console.error('Error creating articles:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

app.get('/post/:id', async (req, res) => {
    try {
        // Validate that id is a number
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return res.status(400).send('Invalid post ID');
        }

        const post = await models.Post.findByPk(id);
        if (!post) {
            return res.status(404).send('Post not found');
        }
        
        res.render('view-news', {post: post});
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).send('Internal server error');
    }
});


app.get('/', async (req, res) => {
    try {
        const posts = await models.Post.findAll();
        res.render('index', {posts: posts});
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal server error');
    }
});

models.initDatabase();
app.listen(8080);

console.log('Aplicação rodando na porta 8080');