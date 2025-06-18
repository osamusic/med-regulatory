import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import axiosClient from '../../api/axiosClient';

const SystemStatus = () => {
  const [dbStatus, setDbStatus] = useState(null);
  const [redisStatus, setRedisStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkDatabaseHealth = async () => {
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
    }
  };

  const checkRedisHealth = async () => {
    try {
      const response = await axiosClient.get('/health/redis');
      setRedisStatus(response.data);
    } catch (error) {
      console.error('Failed to check Redis health:', error);
      setRedisStatus({
        healthy: false,
        details: {
          status: 'check_failed',
          error: error.message
        }
      });
    }
  };

  const checkAllHealth = async () => {
    setIsChecking(true);
    await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth()
    ]);
    setIsChecking(false);
  };

  useEffect(() => {
    checkAllHealth();
    // Check every 60 seconds
    const interval = setInterval(checkAllHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!dbStatus && !redisStatus) return null;

  const getServiceStatus = (serviceStatus, serviceName) => {
    if (!serviceStatus) return { color: 'text-gray-500', icon: <ArrowPathIcon className="h-4 w-4 animate-spin" />, text: 'お待ちください' };
    
    const isHealthy = serviceStatus.healthy;
    const status = serviceStatus.details?.status;
    const isIdle = serviceStatus.details?.is_idle;
    const responseTime = serviceStatus.details?.response_time_ms;

    if (status === 'disabled') return { color: 'text-gray-500', icon: <ExclamationTriangleIcon className="h-4 w-4" />, text: 'Disabled' };
    if (!isHealthy) return { color: 'text-red-600', icon: <ExclamationTriangleIcon className="h-4 w-4" />, text: 'Error' };
    if (isIdle || status === 'recovering_from_idle') return { color: 'text-yellow-600', icon: <ArrowPathIcon className="h-4 w-4 animate-spin" />, text: 'お待ちください' };
    if (responseTime > 500) return { color: 'text-yellow-600', icon: <CheckCircleIcon className="h-4 w-4" />, text: 'Slow' };
    return { color: 'text-green-600', icon: <CheckCircleIcon className="h-4 w-4" />, text: 'OK' };
  };

  const dbServiceStatus = getServiceStatus(dbStatus, 'Database');
  const redisServiceStatus = getServiceStatus(redisStatus, 'Redis');

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={checkAllHealth}
        disabled={isChecking}
        className="flex items-center gap-2 px-3 py-1 text-sm rounded-md hover:bg-gray-100 disabled:opacity-50"
        title="Check system health"
      >
        {isChecking ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin text-gray-500" />
        ) : null}
        
        {/* Database Status */}
        <div className={`flex items-center gap-1 ${dbServiceStatus.color}`}>
          {dbServiceStatus.icon}
          <span className="text-xs">DB: {dbServiceStatus.text}</span>
        </div>

        {/* Redis Status */}
        <div className={`flex items-center gap-1 ${redisServiceStatus.color}`}>
          {redisServiceStatus.icon}
          <span className="text-xs">Cache: {redisServiceStatus.text}</span>
        </div>
      </button>
    </div>
  );
};

export default SystemStatus;