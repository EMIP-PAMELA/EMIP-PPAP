/**
 * Wizard Autofill Rules Engine
 * Phase W2C - Smart Autofill Layer
 * Phase W2D - Autofill Transparency Layer
 *
 * Deterministic rule-based field suggestions for wizard templates.
 * Based on operation description keywords, provides intelligent defaults
 * for control plan methods, PFMEA failure modes, effects, and severity ratings.
 *
 * W2D Enhancement: Each suggestion now includes explainable reasoning
 * to improve transparency and user trust.
 *
 * NO AI. NO EXTERNAL DEPENDENCIES. PURE DETERMINISTIC RULES.
 */

export interface AutofillValue<T> {
  value: T;
  reason: string;
}

export interface OperationInsights {
  category: string;
  method: AutofillValue<string>;
  failureMode: AutofillValue<string>;
  effect: AutofillValue<string>;
  severity: AutofillValue<number>;
}

/**
 * Analyze operation description and return intelligent field suggestions with reasoning
 */
export function getOperationInsights(operation: string): OperationInsights {
  const normalized = operation.toLowerCase().trim();

  // Crimp operations
  if (normalized.includes('crimp')) {
    return {
      category: 'crimping',
      method: {
        value: 'Crimp height measurement',
        reason: "Operation contains 'crimp' → requires crimp height measurement per industry standard"
      },
      failureMode: {
        value: 'Improper crimp',
        reason: 'Crimp operations commonly fail due to improper compression force'
      },
      effect: {
        value: 'Electrical failure',
        reason: 'Improper crimp causes poor electrical connection leading to system failure'
      },
      severity: {
        value: 7,
        reason: 'Electrical failure risk rated at severity 7 (high risk to customer)'
      }
    };
  }

  // Strip operations
  if (normalized.includes('strip')) {
    return {
      category: 'stripping',
      method: {
        value: 'Visual inspection',
        reason: "Operation contains 'strip' → visual inspection verifies conductor integrity"
      },
      failureMode: {
        value: 'Damaged conductor',
        reason: 'Stripping can nick or break conductor strands'
      },
      effect: {
        value: 'Signal degradation',
        reason: 'Damaged conductor reduces current carrying capacity causing signal issues'
      },
      severity: {
        value: 5,
        reason: 'Signal degradation rated at severity 5 (moderate customer impact)'
      }
    };
  }

  // Insert operations
  if (normalized.includes('insert')) {
    return {
      category: 'insertion',
      method: {
        value: 'Insertion force check',
        reason: "Operation contains 'insert' → insertion force validates proper seating"
      },
      failureMode: {
        value: 'Improper insertion',
        reason: 'Terminals can be partially inserted or mis-aligned'
      },
      effect: {
        value: 'Loose connection',
        reason: 'Improper insertion leads to intermittent or failed electrical connection'
      },
      severity: {
        value: 6,
        reason: 'Loose connection risk rated at severity 6 (significant reliability issue)'
      }
    };
  }

  // Cut operations
  if (normalized.includes('cut')) {
    return {
      category: 'cutting',
      method: {
        value: 'Length measurement',
        reason: "Operation contains 'cut' → length measurement ensures dimensional accuracy"
      },
      failureMode: {
        value: 'Incorrect length',
        reason: 'Cutting process can produce out-of-spec lengths'
      },
      effect: {
        value: 'Assembly interference',
        reason: 'Incorrect length prevents proper fit-up during assembly'
      },
      severity: {
        value: 4,
        reason: 'Assembly interference rated at severity 4 (caught before customer)'
      }
    };
  }

  // Solder operations
  if (normalized.includes('solder')) {
    return {
      category: 'soldering',
      method: {
        value: 'Visual inspection + pull test',
        reason: "Operation contains 'solder' → visual + mechanical test validates joint integrity"
      },
      failureMode: {
        value: 'Cold solder joint',
        reason: 'Insufficient heat creates weak mechanical and electrical bond'
      },
      effect: {
        value: 'Intermittent connection',
        reason: 'Cold solder joint fails under thermal cycling or vibration'
      },
      severity: {
        value: 8,
        reason: 'Intermittent connection rated at severity 8 (critical safety/reliability risk)'
      }
    };
  }

  // Seal operations
  if (normalized.includes('seal')) {
    return {
      category: 'sealing',
      method: {
        value: 'Seal integrity check',
        reason: "Operation contains 'seal' → integrity check validates environmental protection"
      },
      failureMode: {
        value: 'Incomplete seal',
        reason: 'Seal may not fully engage or have gaps'
      },
      effect: {
        value: 'Moisture ingress',
        reason: 'Incomplete seal allows moisture/contaminants into assembly'
      },
      severity: {
        value: 7,
        reason: 'Moisture ingress rated at severity 7 (corrosion/failure risk)'
      }
    };
  }

  // Tape/wrap operations
  if (normalized.includes('tape') || normalized.includes('wrap')) {
    return {
      category: 'taping',
      method: {
        value: 'Visual inspection',
        reason: "Operation contains 'tape/wrap' → visual inspection verifies coverage and adhesion"
      },
      failureMode: {
        value: 'Inadequate coverage',
        reason: 'Tape may not fully cover required area or have gaps'
      },
      effect: {
        value: 'Exposed conductors',
        reason: 'Inadequate coverage leaves conductors unprotected from abrasion/shorts'
      },
      severity: {
        value: 6,
        reason: 'Exposed conductor risk rated at severity 6 (potential short circuit)'
      }
    };
  }

  // Install operations
  if (normalized.includes('install')) {
    return {
      category: 'installation',
      method: {
        value: 'Fitment check',
        reason: "Operation contains 'install' → fitment check validates proper mounting/positioning"
      },
      failureMode: {
        value: 'Improper installation',
        reason: 'Component may be incorrectly oriented or not fully seated'
      },
      effect: {
        value: 'Component failure',
        reason: 'Improper installation causes mechanical stress or functional failure'
      },
      severity: {
        value: 6,
        reason: 'Component failure rated at severity 6 (significant functionality loss)'
      }
    };
  }

  // Inspection operations
  if (normalized.includes('inspect') || normalized.includes('check')) {
    return {
      category: 'inspection',
      method: {
        value: 'Visual inspection',
        reason: "Operation contains 'inspect/check' → visual method validates quality attributes"
      },
      failureMode: {
        value: 'Defect not detected',
        reason: 'Inspector may miss defect or apply incorrect acceptance criteria'
      },
      effect: {
        value: 'Defective product shipped',
        reason: 'Undetected defects reach customer causing field failures'
      },
      severity: {
        value: 5,
        reason: 'Defect escape rated at severity 5 (customer dissatisfaction/returns)'
      }
    };
  }

  // Test operations
  if (normalized.includes('test')) {
    return {
      category: 'testing',
      method: {
        value: 'Functional test',
        reason: "Operation contains 'test' → functional test validates performance requirements"
      },
      failureMode: {
        value: 'Test failure',
        reason: 'Product fails to meet functional specifications'
      },
      effect: {
        value: 'Non-functional product',
        reason: 'Test failure indicates product will not perform as designed'
      },
      severity: {
        value: 9,
        reason: 'Non-functional product rated at severity 9 (complete loss of function)'
      }
    };
  }

  // Assembly operations
  if (normalized.includes('assemble') || normalized.includes('assembly')) {
    return {
      category: 'assembly',
      method: {
        value: 'Visual + dimensional check',
        reason: "Operation contains 'assembly' → visual and dimensional checks validate build correctness"
      },
      failureMode: {
        value: 'Incorrect assembly',
        reason: 'Components may be assembled in wrong sequence, orientation, or configuration'
      },
      effect: {
        value: 'Product malfunction',
        reason: 'Incorrect assembly prevents product from operating correctly'
      },
      severity: {
        value: 7,
        reason: 'Product malfunction rated at severity 7 (significant performance degradation)'
      }
    };
  }

  // Label operations
  if (normalized.includes('label') || normalized.includes('mark')) {
    return {
      category: 'labeling',
      method: {
        value: 'Visual inspection',
        reason: "Operation contains 'label/mark' → visual inspection verifies correct marking"
      },
      failureMode: {
        value: 'Missing or incorrect label',
        reason: 'Label may be absent, illegible, or contain wrong information'
      },
      effect: {
        value: 'Traceability loss',
        reason: 'Missing/incorrect label prevents product identification and lot tracking'
      },
      severity: {
        value: 4,
        reason: 'Traceability loss rated at severity 4 (regulatory/logistics issue)'
      }
    };
  }

  // Pack operations
  if (normalized.includes('pack') || normalized.includes('package')) {
    return {
      category: 'packaging',
      method: {
        value: 'Visual inspection',
        reason: "Operation contains 'pack/package' → visual inspection validates protection adequacy"
      },
      failureMode: {
        value: 'Improper packaging',
        reason: 'Product may be inadequately protected or incorrectly oriented in package'
      },
      effect: {
        value: 'Shipping damage',
        reason: 'Improper packaging allows product damage during handling/transport'
      },
      severity: {
        value: 5,
        reason: 'Shipping damage rated at severity 5 (customer receives damaged product)'
      }
    };
  }

  // Default for unknown operations
  return {
    category: 'general',
    method: {
      value: 'Standard inspection',
      reason: 'Operation not matched to specific pattern → default to standard inspection'
    },
    failureMode: {
      value: 'Process deviation',
      reason: 'Generic process may deviate from specification'
    },
    effect: {
      value: 'Quality issue',
      reason: 'Process deviation can result in quality defects'
    },
    severity: {
      value: 5,
      reason: 'Generic quality issue rated at severity 5 (moderate risk)'
    }
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
