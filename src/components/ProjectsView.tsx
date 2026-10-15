import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Trash2, 
  ArrowUpRight, 
  Sparkles,
  BarChart2,
  Edit3,
  Paperclip
} from 'lucide-react';
import { AppProject, AppTask, AppNote } from '../lib/types';
import { ProjectModal } from './ProjectModal';

interface ProjectsViewProps {
  projects: AppProject[];
  tasks: AppTask[];
  notes: AppNote[];
  onCreateProject: (project: Partial<AppProject>) => Promise<void>;
  onUpdateProject: (id: string, updates: Partial<AppProject>) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onSelectProject: (projectId: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  notes,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSelectProject
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AppProject | null>(null);

  const handleOpenNew = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project: AppProject) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (projectData: Partial<AppProject>) => {
    if (selectedProject?.id) {
      await onUpdateProject(selectedProject.id, projectData);
      // Update selected project in local state if modal stays open
      setSelectedProject(prev => prev ? { ...prev, ...projectData } as AppProject : null);
    } else {
      await onCreateProject(projectData);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-400" />
            Gestor de Proyectos
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Coordina objetivos, progreso y conecta notas, tareas y adjuntos por proyecto.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm shadow-blue-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proyecto</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {projects.map((project) => {
            const projectTasks = tasks.filter(t => t.project_id === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'completed');
            const projectNotes = notes.filter(n => n.project_id === project.id);
            const computedProgress = projectTasks.length > 0 
              ? Math.round((completedTasks.length / projectTasks.length) * 100) 
              : (project.progress || 0);

            return (
              <div
                key={project.id}
                className="bg-[#1a1a24] rounded-xl border border-[#2b2b3a] hover:border-[#3c3c52] transition p-5 flex flex-col justify-between shadow-sm group"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div 
                      onClick={() => handleOpenEdit(project)}
                      className="flex items-center gap-2.5 cursor-pointer flex-1"
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      >
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-semibold text-sm text-white leading-tight truncate hover:text-blue-400 transition">
                          {project.title}
                        </h3>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                          {project.status}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(project)}
                        className="text-gray-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-[#252535] transition"
                        title="Editar proyecto y gestionar adjuntos"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar proyecto "${project.title}"?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">
                      {project.description}
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Progreso ({completedTasks.length}/{projectTasks.length} tareas)</span>
                      <span className="font-mono text-gray-200">{computedProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#121218] rounded-full overflow-hidden border border-[#262635]">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${computedProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="pt-3 border-t border-[#252535] flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1" title="Tareas vinculadas">
                      <CheckSquare className="w-3 h-3 text-amber-400" />
                      {projectTasks.length}
                    </span>
                    <span className="flex items-center gap-1" title="Notas vinculadas">
                      <FileText className="w-3 h-3 text-purple-400" />
                      {projectNotes.length}
                    </span>
                    {project.due_date && (
                      <span className="flex items-center gap-1 text-[10px]" title="Fecha límite">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(project.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenEdit(project)}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                  >
                    Editar & Adjuntos
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Project Modal (Edit, Attachments, Tasks) */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={selectedProject}
        tasks={tasks}
        notes={notes}
        onSave={handleSaveModal}
        onDelete={onDeleteProject}
      />
    </div>
  );
};
