/**
 * Password validation and strength checking utilities
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

export const validatePassword = (password) => {
  const errors = [];
  const checks = {
    length: false,
    uppercase: false,
    lowercase: false,
    numbers: false,
    specialChars: false,
  };

  // Length check
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) {
    checks.length = true;
  } else {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    checks.uppercase = true;
  } else {
    errors.push('At least one uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    checks.lowercase = true;
  } else {
    errors.push('At least one lowercase letter');
  }

  // Numbers check
  if (/[0-9]/.test(password)) {
    checks.numbers = true;
  } else {
    errors.push('At least one number');
  }

  // Special characters check
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    checks.specialChars = true;
  } else {
    errors.push('At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    checks,
  };
};

export const calculatePasswordStrength = (password) => {
  const validation = validatePassword(password);
  const { checks } = validation;
  
  let score = 0;
  let maxScore = 5;
  
  // Basic requirements (each worth 1 point)
  if (checks.length) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.numbers) score += 1;
  if (checks.specialChars) score += 1;
  
  // Bonus points for length
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  maxScore += 2;
  
  // Bonus for variety of special characters
  const specialCharCount = (password.match(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g) || []).length;
  if (specialCharCount >= 2) score += 1;
  maxScore += 1;
  
  const percentage = Math.round((score / maxScore) * 100);
  
  let strength = 'Very Weak';
  let color = 'red';
  
  if (percentage >= 90) {
    strength = 'Very Strong';
    color = 'green';
  } else if (percentage >= 75) {
    strength = 'Strong';
    color = 'lightgreen';
  } else if (percentage >= 50) {
    strength = 'Medium';
    color = 'yellow';
  } else if (percentage >= 25) {
    strength = 'Weak';
    color = 'orange';
  }
  
  return {
    score,
    maxScore,
    percentage,
    strength,
    color,
    isValid: validation.isValid,
  };
};