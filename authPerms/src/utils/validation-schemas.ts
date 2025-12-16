import Joi from 'joi';

export const authSchemas = {
  login: Joi.object({
    matricule: Joi.string()
      .pattern(/^[A-Z]{3}\d{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Matricule must be in format: 3 uppercase letters followed by 9 digits',
        'any.required': 'Matricule is required',
      }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required',
    }),
    role: Joi.string()
      .valid('etudiant', 'enseignant', 'admin', 'doyen', 'recteur')
      .required()
      .messages({
        'any.only': 'Role must be one of: etudiant, enseignant, admin, doyen, recteur',
        'any.required': 'Role is required',
      }),
  }),

  register: Joi.object({
    matricule: Joi.string()
      .pattern(/^[A-Z]{3}\d{9}$/)
      .required(),
    password: Joi.string().min(8).required(),
    role: Joi.string()
      .valid('etudiant', 'enseignant', 'admin', 'doyen', 'recteur')
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  checkPermission: Joi.object({
    nom_objet: Joi.string().required(),
    action: Joi.string().valid('read', 'write', 'update', 'delete').required(),
  }),

  updateUser: Joi.object({
    is_active: Joi.boolean(),
    is_connected: Joi.boolean(),
  }),

  createPermission: Joi.object({
    nom_objet_bd: Joi.string().required(),
    type_permission: Joi.string().valid('read', 'write', 'update', 'delete').required(),
    description: Joi.string().optional(),
  }),

  assignPermission: Joi.object({
    mat: Joi.string().required(),
    idperm: Joi.string().uuid().required(),
    statut: Joi.string().valid('granted', 'revoked', 'waiting').default('waiting'),
  }),
};