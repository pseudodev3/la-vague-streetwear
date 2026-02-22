/**
 * LA VAGUE - API Documentation Logic
 */
window.onload = function() {
    if (typeof SwaggerUIBundle !== 'undefined') {
        SwaggerUIBundle({
            url: "openapi.yaml",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            validatorUrl: null,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
        });
    }
};
