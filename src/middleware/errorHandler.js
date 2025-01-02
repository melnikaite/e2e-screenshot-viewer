export const errorHandler = (err, req, res, next) => {
    // Log error details for debugging
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: err.stack
    });

    return res.status(500).json({
        error: err.message || 'Internal Server Error',
        stack: err.stack,
    });
};
