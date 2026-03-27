// =============================================================================
// IT Project Tracker — Configuration PM2
// =============================================================================

module.exports = {
  apps: [
    {
      name: 'tracker',
      script: 'src/app.js',
      cwd: '/opt/tracker/server',

      // node:sqlite nécessite --experimental-sqlite
      // On passe via node_args (plus fiable que interpreter_args sous PM2)
      node_args: '--experimental-sqlite',

      // Environnement de production
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Politique de redémarrage
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // Logs
      out_file:        '/opt/tracker/logs/app.out.log',
      error_file:      '/opt/tracker/logs/app.error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      true,

      // Rotation des logs (nécessite pm2-logrotate)
      max_size:    '50M',
      retain:      7,
    },
  ],
}
