import auth from 'basic-auth';

export const authenticate = (req, res, next) => {
    const credentials = auth(req);

    if (!credentials ||
        credentials.name !== process.env.BASIC_AUTH_USER ||
        credentials.pass !== process.env.BASIC_AUTH_PASSWORD) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Screenshot Viewer"');
        return res.status(401).json({ error: "Authentication required" });
    }

    next();
};
