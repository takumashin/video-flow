'use client'

import { ReactFlowProvider } from 'reactflow'
import WorkflowCanvas from '@/components/canvas/workflow-canvas'
import AssetLibrarySidebar from '@/components/asset-library-sidebar'
import AssetLibraryToggle from '@/components/asset-library-toggle'
import SeedanceConfigSidebar from '@/components/seedance-config-sidebar'
import { useAssetLibraryStore } from '@/store/asset-library-store'

export default function StudioWorkspace() {
  const isAssetLibraryOpen = useAssetLibraryStore(s => s.isOpen)

  return (
    <ReactFlowProvider>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isAssetLibraryOpen && <AssetLibrarySidebar />}
        <div className="relative z-0 isolate min-h-0 min-w-0 flex-1 overflow-hidden">
          {!isAssetLibraryOpen && <AssetLibraryToggle />}
          <WorkflowCanvas />
        </div>
        <SeedanceConfigSidebar />
      </div>
    </ReactFlowProvider>
  )
}
