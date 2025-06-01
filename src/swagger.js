import swaggerAutogen from 'swagger-autogen';

const doc = {
    info: {
        version: 'v1.0.0',
        title: 'Dern-Support API',
        description: 'Dern-Support is a seamless platform that connects clients with verified legal experts, offering secure communication, easy appointment booking, transparent pricing, and comprehensive legal services all in one place.'
    },
    host: `localhost:${process.env.PORT || 5000}`,
    basePath: '/api/v1',
    schemes: ['http', 'https'],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['src/routes/index.js'];

swaggerAutogen()(outputFile, endpointsFiles, doc);
