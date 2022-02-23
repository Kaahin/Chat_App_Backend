const router = require('express').Router();

const User = require('../model/User');
const {registerValidation, loginValidation} = require('../validation')
const bcrypt = require('bcryptjs'); // hashar vår lösenord, krypterar lösenordet
const jwt = require('jsonwebtoken'); // importerar jsonwebtoken

router.post('/register', async (req, res) => {
    // Validate user 
    const {error} = registerValidation(req.body);
    

    if(error) {
        return res.status(400).json({error: error.details[0].message});
    }

    // if existing user
    const emailExist = await User.findOne({email: req.body.email});
    
    if(emailExist) {
        return res.status(400).json({error: 'email: req.body.email'});
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10); // Här skapar vi en algoritm för hur säker vår lösen ska vara
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    // Create user!
    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: hashPassword
    });

    try {
        const savedUser = await user.save(); // detta sparar User i databasen
        const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET);
        res.json({user: user._id, redirect: 'batcave', token}); // skickar detta information till frontend.
    } catch (error) {
        res.status(400).json(error);
    }
   

});

router.post('/login', async (req, res) => {

    // Validate user
    const {error} = loginValidation(req.body);

    if(error) {
        return res.status(400).json({error: error.details[0].message});
    }

    // if existing email
    const user = await User.findOne({email: req.body.email});

    if(!user) {
        return res.status(400).json({error: 'Email is not found'});
    }

    // Password correct?
    const validPassword = await bcrypt.compare(req.body.password, user.password);

    if(!validPassword) {
        return res.status(400).json({error: 'Invalid password'});
    }

    // create and assign token.
    const token = jwt.sign({_id: user._id}, process.env.TOKEN_SECRET); // skapar en token för att skicka till frontend
    res.header('auth-token', token).json({token, redirect:'batcave'}); //Här
});

module.exports = router;