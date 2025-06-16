import axiosClient from './axiosClient';

export const workflowAPI = {
  // Create workflow for a project and phase
  createWorkflow: async (projectId, phase) => {
    const response = await axiosClient.post(`/workflow/create/${projectId}/${phase}`);
    return response.data;
  },

  // Get workflow for a project and phase
  getWorkflow: async (projectId, phase) => {
    const response = await axiosClient.get(`/workflow/get/${projectId}/${phase}`);
    return response.data;
  },

  // List all workflows for a project
  listWorkflows: async (projectId) => {
    const response = await axiosClient.get(`/workflow/list/${projectId}`);
    return response.data;
  },

  // Delete workflow for a project and phase
  deleteWorkflow: async (projectId, phase) => {
    const response = await axiosClient.delete(`/workflow/delete/${projectId}/${phase}`);
    return response.data;
  }
};

export default workflowAPI;