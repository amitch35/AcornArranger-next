export const isExternalCallsEnabled = () => process.env.NODE_ENV === 'production' && process.env.EXTERNAL_CALLS_ENABLED === 'true';

export const isDev = () => process.env.NODE_ENV !== 'production';
