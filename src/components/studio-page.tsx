'use client'

import StudioWorkspace from '@/components/studio-workspace'
import VideoHistoryModal from '@/components/canvas/video-history-modal'
import MediaPreviewModal from '@/components/media-preview-modal'
import RunLogPanel from '@/components/canvas/run-log-panel'
import StudioHeader from '@/components/studio-header'
import StudioWorkDock from '@/components/studio-work-dock'
import TaskQueuePanel from '@/components/task-queue-panel'
import TaskQueueBootstrap from '@/components/task-queue-bootstrap'
import WorkflowAutoSave from '@/components/workflow-auto-save'
import WorkflowCollaboration from '@/components/workflow-collaboration'
import { WorkflowCollaborationBanner } from '@/components/workflow-conflict-dialog'
import WorkflowBootstrap from '@/components/workflow-bootstrap'
import SeedanceJobRecovery from '@/components/seedance-job-recovery'
import WorkflowTabs from '@/components/workflow-tabs'
import WorkflowVersionPanel from '@/components/workflow-version-panel'
import WorkflowVersionDiff from '@/components/workflow-version-diff'
import WorkflowVersionSaveDialog from '@/components/workflow-version-save-dialog'

const HEADER_HEIGHT = '3rem' /* h-12 */

export default function StudioPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <StudioHeader />
      <main
        className="flex h-full flex-col overflow-hidden"
        style={{ paddingTop: HEADER_HEIGHT }}
      >
        <WorkflowTabs />
        <WorkflowCollaborationBanner />
        <StudioWorkspace />
        <StudioWorkDock />
        <RunLogPanel />
      </main>
      <VideoHistoryModal />
      <MediaPreviewModal />
      <TaskQueuePanel />
      <WorkflowVersionPanel />
      <WorkflowVersionDiff />
      <WorkflowVersionSaveDialog />
      <WorkflowAutoSave />
      <WorkflowCollaboration />
      <WorkflowBootstrap />
      <TaskQueueBootstrap />
      <SeedanceJobRecovery />
    </div>
  )
}
