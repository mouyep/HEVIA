export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  meta?: {
    timestamp: Date;
    path?: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  statusCode?: number; // AJOUT: propriété manquante
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    timestamp: Date;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export class ResponseBuilder {
  static success<T>(data?: T, message = 'Request successful'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date(),
      },
    };
  }

  static error(message: string, errors?: ApiResponse['errors'], statusCode?: number): ApiResponse {
    const response: ApiResponse = {
      success: false,
      message,
      errors,
      meta: {
        timestamp: new Date(),
      },
    };

    // Maintenant TypeScript accepte statusCode car il est défini dans l'interface
    if (statusCode) {
      response.statusCode = statusCode;
    }

    return response;
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message = 'Data retrieved successfully'
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date(),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    };
  }

  static fromError(error: any): ApiResponse {
    // Gestion des erreurs personnalisées
    if (error.statusCode || error.status) {
      const statusCode = error.statusCode || error.status;
      
      return {
        success: false,
        message: error.message || 'An error occurred',
        errors: error.errors || [{ message: error.message || 'Unknown error' }],
        meta: {
          timestamp: new Date(),
        },
        statusCode, // Pas besoin de vérification conditionnelle maintenant
      };
    }

    // Gestion des erreurs de validation
    if (error.name === 'ValidationError' || error.errors) {
      const validationErrors = error.errors
        ? Object.keys(error.errors).map((field) => ({
            field,
            message: error.errors[field].message || 'Validation error',
          }))
        : [{ message: error.message || 'Validation error' }];

      return {
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        meta: {
          timestamp: new Date(),
        },
        statusCode: 400,
      };
    }

    // Erreur par défaut
    return {
      success: false,
      message: error.message || 'Internal server error',
      errors: [{ message: error.message || 'Unknown error occurred' }],
      meta: {
        timestamp: new Date(),
      },
      statusCode: 500,
    };
  }

  static unauthorized(message = 'Unauthorized access'): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 401,
    };
  }

  static forbidden(message = 'Forbidden access'): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 403,
    };
  }

  static notFound(message = 'Resource not found'): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 404,
    };
  }

  static badRequest(message = 'Bad request', errors?: ApiResponse['errors']): ApiResponse {
    return {
      success: false,
      message,
      errors,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 400,
    };
  }

  static conflict(message = 'Conflict occurred'): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 409,
    };
  }

  static tooManyRequests(message = 'Too many requests'): ApiResponse {
    return {
      success: false,
      message,
      meta: {
        timestamp: new Date(),
      },
      statusCode: 429,
    };
  }
}

// Fonctions utilitaires supplémentaires
export const createResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
  statusCode?: number
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    success,
    message,
    data,
    meta: {
      timestamp: new Date(),
    },
  };

  if (statusCode) {
    response.statusCode = statusCode;
  }

  return response;
};

export const createErrorResponse = (
  message: string,
  statusCode = 500,
  errors?: ApiResponse['errors']
): ApiResponse => {
  return ResponseBuilder.error(message, errors, statusCode);
};

export const createSuccessResponse = <T>(data?: T, message = 'Success'): ApiResponse<T> => {
  return ResponseBuilder.success(data, message);
};