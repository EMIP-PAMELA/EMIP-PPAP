/**
 * Wizard Autofill Rules Engine
 * Phase W2C - Smart Autofill Layer
 *
 * Deterministic rule-based field suggestions for wizard templates.
 * Based on operation description keywords, provides intelligent defaults
 * for control plan methods, PFMEA failure modes, effects, and severity ratings.
 *
 * NO AI. NO EXTERNAL DEPENDENCIES. PURE DETERMINISTIC RULES.
 */

export interface OperationInsights {
  category: string;
  suggestedMethod: string;
  suggestedFailureMode: string;
  suggestedEffect: string;
  suggestedSeverity: number;
}

/**
 * Analyze operation description and return intelligent field suggestions
 */
export function getOperationInsights(operation: string): OperationInsights {
  const normalized = operation.toLowerCase().trim();

  // Crimp operations
  if (normalized.includes('crimp')) {
    return {
      category: 'crimping',
      suggestedMethod: 'Crimp height measurement',
      suggestedFailureMode: 'Improper crimp',
      suggestedEffect: 'Electrical failure',
      suggestedSeverity: 7
    };
  }

  // Strip operations
  if (normalized.includes('strip')) {
    return {
      category: 'stripping',
      suggestedMethod: 'Visual inspection',
      suggestedFailureMode: 'Damaged conductor',
      suggestedEffect: 'Signal degradation',
      suggestedSeverity: 5
    };
  }

  // Insert operations
  if (normalized.includes('insert')) {
    return {
      category: 'insertion',
      suggestedMethod: 'Insertion force check',
      suggestedFailureMode: 'Improper insertion',
      suggestedEffect: 'Loose connection',
      suggestedSeverity: 6
    };
  }

  // Cut operations
  if (normalized.includes('cut')) {
    return {
      category: 'cutting',
      suggestedMethod: 'Length measurement',
      suggestedFailureMode: 'Incorrect length',
      suggestedEffect: 'Assembly interference',
      suggestedSeverity: 4
    };
  }

  // Solder operations
  if (normalized.includes('solder')) {
    return {
      category: 'soldering',
      suggestedMethod: 'Visual inspection + pull test',
      suggestedFailureMode: 'Cold solder joint',
      suggestedEffect: 'Intermittent connection',
      suggestedSeverity: 8
    };
  }

  // Seal operations
  if (normalized.includes('seal')) {
    return {
      category: 'sealing',
      suggestedMethod: 'Seal integrity check',
      suggestedFailureMode: 'Incomplete seal',
      suggestedEffect: 'Moisture ingress',
      suggestedSeverity: 7
    };
  }

  // Tape/wrap operations
  if (normalized.includes('tape') || normalized.includes('wrap')) {
    return {
      category: 'taping',
      suggestedMethod: 'Visual inspection',
      suggestedFailureMode: 'Inadequate coverage',
      suggestedEffect: 'Exposed conductors',
      suggestedSeverity: 6
    };
  }

  // Install operations
  if (normalized.includes('install')) {
    return {
      category: 'installation',
      suggestedMethod: 'Fitment check',
      suggestedFailureMode: 'Improper installation',
      suggestedEffect: 'Component failure',
      suggestedSeverity: 6
    };
  }

  // Inspection operations
  if (normalized.includes('inspect') || normalized.includes('check')) {
    return {
      category: 'inspection',
      suggestedMethod: 'Visual inspection',
      suggestedFailureMode: 'Defect not detected',
      suggestedEffect: 'Defective product shipped',
      suggestedSeverity: 5
    };
  }

  // Test operations
  if (normalized.includes('test')) {
    return {
      category: 'testing',
      suggestedMethod: 'Functional test',
      suggestedFailureMode: 'Test failure',
      suggestedEffect: 'Non-functional product',
      suggestedSeverity: 9
    };
  }

  // Assembly operations
  if (normalized.includes('assemble') || normalized.includes('assembly')) {
    return {
      category: 'assembly',
      suggestedMethod: 'Visual + dimensional check',
      suggestedFailureMode: 'Incorrect assembly',
      suggestedEffect: 'Product malfunction',
      suggestedSeverity: 7
    };
  }

  // Label operations
  if (normalized.includes('label') || normalized.includes('mark')) {
    return {
      category: 'labeling',
      suggestedMethod: 'Visual inspection',
      suggestedFailureMode: 'Missing or incorrect label',
      suggestedEffect: 'Traceability loss',
      suggestedSeverity: 4
    };
  }

  // Pack operations
  if (normalized.includes('pack') || normalized.includes('package')) {
    return {
      category: 'packaging',
      suggestedMethod: 'Visual inspection',
      suggestedFailureMode: 'Improper packaging',
      suggestedEffect: 'Shipping damage',
      suggestedSeverity: 5
    };
  }

  // Default for unknown operations
  return {
    category: 'general',
    suggestedMethod: 'Standard inspection',
    suggestedFailureMode: 'Process deviation',
    suggestedEffect: 'Quality issue',
    suggestedSeverity: 5
  };
}

/**
 * Get additional control plan suggestions based on operation category
 */
export function getControlPlanDefaults(category: string): {
  sampleSize: string;
  frequency: string;
} {
  switch (category) {
    case 'crimping':
    case 'soldering':
      return {
        sampleSize: '5 per lot',
        frequency: 'Every lot'
      };
    
    case 'testing':
      return {
        sampleSize: '100%',
        frequency: 'Continuous'
      };
    
    case 'inspection':
      return {
        sampleSize: '10 per shift',
        frequency: 'Per shift'
      };
    
    default:
      return {
        sampleSize: 'As required',
        frequency: 'Per lot'
      };
  }
}

/**
 * Get PFMEA-specific defaults based on operation category
 */
export function getPfmeaDefaults(category: string): {
  occurrence: number;
  detection: number;
} {
  switch (category) {
    case 'crimping':
    case 'soldering':
      return { occurrence: 4, detection: 3 }; // Critical ops, good detection
    
    case 'testing':
      return { occurrence: 2, detection: 1 }; // Low occurrence, excellent detection
    
    case 'inspection':
      return { occurrence: 3, detection: 2 }; // Medium occurrence, good detection
    
    case 'manual':
    case 'assembly':
      return { occurrence: 5, detection: 5 }; // Higher occurrence, medium detection
    
    default:
      return { occurrence: 4, detection: 4 }; // Default moderate ratings
  }
}
