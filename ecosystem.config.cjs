module.exports = {
    apps: [
        {
            name: 'atakod-backend',
            script: 'server.js',
            cwd: './windows-backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            error_file: './logs/backend-error.log',
            out_file: './logs/backend-out.log',
            log_file: './logs/backend-combined.log',
            time: true
        },
        {
            name: 'atakod-frontend',
            script: 'serve',
            args: '-s dist -l 3000',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            log_file: './logs/frontend-combined.log',
            time: true
        }
    ]
}
