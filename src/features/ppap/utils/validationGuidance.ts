export interface ValidationGuidance {
  id: string;
  title: string;
  description: string;
}

export const VALIDATION_GUIDANCE: Record<string, ValidationGuidance> = {
  process_flow: {
    id: 'process_flow',
    title: 'Process Flow Diagram',
    description: 'Defines the complete manufacturing process from raw material to finished product. Must align with PFMEA and Control Plan. Shows sequence of operations, equipment, and material flow.',
  },
  dfmea: {
    id: 'dfmea',
    title: 'DFMEA',
    description: 'Design Failure Mode and Effects Analysis. Identifies potential design risks and mitigation strategies. Evaluates design weaknesses before production begins.',
  },
  pfmea: {
    id: 'pfmea',
    title: 'PFMEA',
    description: 'Process Failure Mode and Effects Analysis. Identifies potential process risks and controls. Documents how manufacturing process could fail and preventive measures.',
  },
  control_plan: {
    id: 'control_plan',
    title: 'Control Plan',
    description: 'Documents inspection and testing methods for critical characteristics. Defines what to measure, how to measure, and acceptance criteria. Links to PFMEA risk controls.',
  },
  measurement_plan: {
    id: 'measurement_plan',
    title: 'Measurement Plan',
    description: 'Defines measurement methods, equipment, and frequency for all critical dimensions. Ensures consistent inspection approach across production runs.',
  },
  dimensional_results: {
    id: 'dimensional_results',
    title: 'Dimensional Results',
    description: 'Actual measurement data from production samples. Must demonstrate all dimensions meet drawing specifications. Typically requires 5-10 sample parts measured.',
  },
  material_certs: {
    id: 'material_certs',
    title: 'Material Certifications',
    description: 'Certificates from material suppliers confirming material composition and properties. Must match drawing material specifications. Includes mill test reports and compliance documents.',
  },
  performance_tests: {
    id: 'performance_tests',
    title: 'Performance Test Results',
    description: 'Functional testing data demonstrating part meets performance requirements. May include pressure tests, flow tests, durability tests, or customer-specific validation.',
  },
  msa: {
    id: 'msa',
    title: 'MSA',
    description: 'Measurement System Analysis. Validates that measurement equipment and methods are capable and repeatable. Ensures inspection results are reliable and consistent.',
  },
  capability: {
    id: 'capability',
    title: 'Capability Studies',
    description: 'Statistical analysis (Cpk, Ppk) demonstrating process can consistently produce parts within specification. Typically requires 25-30 consecutive parts. Cpk ≥ 1.33 often required.',
  },
  psw: {
    id: 'psw',
    title: 'PSW',
    description: 'Part Submission Warrant. Summary document certifying all PPAP requirements are met. Signed by authorized supplier representative. Required for customer approval.',
  },
  packaging: {
    id: 'packaging',
    title: 'Packaging Approval',
    description: 'Confirms packaging design protects parts during shipping and meets customer requirements. Includes packaging drawings, testing results, and labeling verification.',
  },
  final_control_plan: {
    id: 'final_control_plan',
    title: 'Final Control Plan',
    description: 'Updated control plan reflecting actual production methods and inspection results. Incorporates lessons learned from initial production runs. Used for ongoing production.',
  },
  appearance_approval: {
    id: 'appearance_approval',
    title: 'Appearance Approval',
    description: 'Customer approval of part appearance, finish, and cosmetic characteristics. Includes color, texture, surface finish, and visual quality standards.',
  },
};

export function getValidationGuidance(validationId: string): ValidationGuidance | undefined {
  return VALIDATION_GUIDANCE[validationId];
}
