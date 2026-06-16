'use client'

import StudioWorkspace from '@/components/studio-workspace'
import VideoHistoryModal from '@/components/canvas/video-history-modal'
import MediaPreviewModal from '@/components/media-preview-modal'
import RunLogPanel from '@/components/canvas/run-log-panel'
import StudioHeader from '@/components/studio-header'
import TaskQueuePanel from '@/components/task-queue-panel'
import WorkflowAutoSave from '@/components/workflow-auto-save'
import SeedanceJobRecovery from '@/components/seedance-job-recovery'
import WorkflowTabs from '@/components/workflow-tabs'

const HEADER_HEIGHT = '3.5rem' /* h-14 */

export default function StudioPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <StudioHeader />
      <main
        className="flex h-full flex-col overflow-hidden"
        style={{ paddingTop: HEADER_HEIGHT }}
      >
        <WorkflowTabs />
        <StudioWorkspace />
        <RunLogPanel />
      </main>
      <VideoHistoryModal />
      <MediaPreviewModal />
      <TaskQueuePanel />
      <WorkflowAutoSave />
      <SeedanceJobRecovery />
    </div>
  )
}
