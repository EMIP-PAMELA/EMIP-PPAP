'use client';

import { useState, useEffect } from 'react';
import { getTemplate } from '../templates/registry';
import { TemplateId, TemplateInputField } from '../templates/types';

interface TemplateInputFormProps {
  templateId: TemplateId;
  onInputsComplete: (inputs: Record<string, any>) => void;
}

export function TemplateInputForm({ templateId, onInputsComplete }: TemplateInputFormProps) {
  const [fields, setFields] = useState<TemplateInputField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const template = getTemplate(templateId);
    setFields(template.requiredInputs);
    
    const initialValues: Record<string, string> = {};
    template.requiredInputs.forEach(field => {
      initialValues[field.key] = '';
    });
    setValues(initialValues);
  }, [templateId]);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateAndSubmit = () => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (field.required && !values[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onInputsComplete(values);
  };

  const isFormValid = fields.every(field => 
    !field.required || values[field.key]?.trim()
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Provide Required Information</h3>
      
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={values[field.key] || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`
                w-full px-3 py-2 border rounded-md
                ${errors[field.key] 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-blue-500'
                }
                focus:outline-none focus:ring-2
              `}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {errors[field.key] && (
              <p className="text-red-600 text-sm mt-1">{errors[field.key]}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={validateAndSubmit}
        disabled={!isFormValid}
        className={`
          w-full py-3 px-4 rounded-md font-semibold text-white
          ${isFormValid
            ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            : 'bg-gray-300 cursor-not-allowed'
          }
          transition-colors
        `}
      >
        Generate Document
      </button>
    </div>
  );
}
