import { calculatePasswordStrength, validatePassword } from '../../utils/passwordValidation';

const PasswordMeter = ({ password, showRequirements = true }) => {
  const strength = calculatePasswordStrength(password);
  const validation = validatePassword(password);

  const getBackgroundColorClass = (color) => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'lightgreen':
        return 'bg-green-400';
      case 'yellow':
        return 'bg-yellow-500';
      case 'orange':
        return 'bg-orange-500';
      case 'red':
      default:
        return 'bg-red-500';
    }
  };

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Strength Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Password Strength: {strength.strength}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {strength.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getBackgroundColorClass(strength.color)}`}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password Requirements:
          </div>
          {[
            { key: 'length', label: 'At least 8 characters' },
            { key: 'uppercase', label: 'One uppercase letter (A-Z)' },
            { key: 'lowercase', label: 'One lowercase letter (a-z)' },
            { key: 'numbers', label: 'One number (0-9)' },
            { key: 'specialChars', label: 'One special character (!@#$%^&*)' },
          ].map(({ key, label }) => (
            <div
              key={key}
              className={`flex items-center text-xs ${
                validation.checks[key]
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className={`mr-2 ${validation.checks[key] ? 'text-green-500' : 'text-gray-400'}`}>
                {validation.checks[key] ? '✓' : '○'}
              </span>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordMeter;