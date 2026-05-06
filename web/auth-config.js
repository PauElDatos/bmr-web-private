// Fase 6: por defecto la web sigue funcionando en modo local/mock sin auth.
// En producción, cambia enabled/protectedData a true o usa auth-config.example.js como guía.
window.BMR_AUTH = {
  enabled: false,
  authBase: '',
  loginPath: '/auth/login',
  logoutPath: '/auth/logout',
  mePath: '/api/me',
  protectedData: false
};
