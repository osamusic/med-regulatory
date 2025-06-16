import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import axiosClient from '../../api/axiosClient';

const SystemStatus = () => {
  const [dbStatus, setDbStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkDatabaseHealth = async () => {
    setIsChecking(true);
    try {
      const response = await axiosClient.get('/health/db');
      setDbStatus(response.data);
    } catch (error) {
      console.error('Failed to check database health:', error);
      setDbStatus({
        healthy: false,
        details: {
          status: 'check_failed',
          error: error.message
        }
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkDatabaseHealth();
    // Check every 60 seconds
    const interval = setInterval(checkDatabaseHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!dbStatus) return null;

  const isHealthy = dbStatus.healthy;
  const isIdle = dbStatus.details?.is_idle;
  const status = dbStatus.details?.status;
  const responseTime = dbStatus.details?.response_time_ms;

  const getStatusColor = () => {
    if (status === 'disabled') return 'text-gray-500';
    if (!isHealthy) return 'text-red-600';
    if (isIdle || status === 'recovering_from_idle') return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (status === 'disabled') return <ExclamationTriangleIcon className="h-5 w-5" />;
    if (!isHealthy) return <ExclamationTriangleIcon className="h-5 w-5" />;
    if (isIdle || status === 'recovering_from_idle') return <ArrowPathIcon className="h-5 w-5 animate-spin" />;
    return <CheckCircleIcon className="h-5 w-5" />;
  };

  const getStatusText = () => {
    if (status === 'disabled') return 'Monitoring disabled';
    if (!isHealthy) {
      if (status === 'database_idle') return 'System starting';
      return 'Connecting';
    }
    if (status === 'recovering_from_idle') return 'Reconnecting...';
    if (responseTime > 500) return 'Slow response';
    return 'Connected';
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={checkDatabaseHealth}
        disabled={isChecking || status === 'disabled'}
        className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md ${getStatusColor()} hover:bg-gray-100 disabled:opacity-50`}
        title={status === 'disabled' ? 'Health monitoring disabled by administrator' : 'System status'}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </button>
    </div>
  );
};

export default SystemStatus;