'use client';

import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../i18n/useI18n';
import { useAppState, type AppState } from '../../useAppState';
import { useGeolocation } from '../../useGeolocation';
import { useTrails } from '../../useTrails';
import { CacheMarksProvider } from '../CacheDetails/marks';
import { DataDialog } from '../DataDialog';
import { EmptyState } from '../EmptyState';
import { Header } from '../Header';
import { ImportSummary } from '../ImportSummary';
import { MainView } from '../MainView';
import { ErrorNotice } from '../Notice';
import { SettingsDialog } from '../SettingsDialog';
import { SharedImportDialog } from '../SharedImportDialog';
import { ToastProvider } from '../Toast/ToastProvider';
import { WalkView } from '../WalkView';

type OpenDialog = 'none' | 'settings' | 'data';

function Loading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex flex-1 items-center justify-center gap-3 text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin"
      />
      {t('common.loading')}
    </div>
  );
}

function Shell() {
  const app: AppState = useAppState();
  const { location, start } = useGeolocation();
  const [dialog, setDialog] = useState<OpenDialog>('none');
  const close = () => setDialog('none');
  // Ignored caches leave the trails the same way found ones do.
  const excluded = useMemo(
    () => new Set([...app.locallyFound, ...app.ignored]),
    [app.locallyFound, app.ignored],
  );
  const { trails, pending } = useTrails({
    caches: app.caches,
    settings: app.settings,
    locallyFound: excluded,
  });
  const walking = app.walk !== undefined;

  // A walk, started here or resumed after a reload, needs the position.
  useEffect(() => {
    if (walking) start();
  }, [walking, start]);

  const ignored = useMemo(() => {
    const names = new Map(app.caches.map((cache) => [cache.code, cache.name]));
    return [...app.ignored].map((code) => ({
      code,
      name: names.get(code) ?? '',
    }));
  }, [app.caches, app.ignored]);

  const importAndClose = (files: File[]) => {
    close();
    void app.importFiles(files);
  };

  const screen = () => {
    if (!app.ready) return <Loading />;
    if (app.walk) {
      return (
        <WalkView
          walk={app.walk}
          caches={app.caches}
          settings={app.settings}
          location={location}
          startLocation={start}
          showOtherCaches={app.preferences.showOtherCaches}
          onToggleOtherCaches={() =>
            app.setPreferences({
              showOtherCaches: !app.preferences.showOtherCaches,
            })
          }
          onRecord={app.recordOutcome}
          onUndo={app.undoOutcome}
          onReverse={app.reverseWalk}
          onEnd={app.endWalk}
        />
      );
    }
    if (app.caches.length === 0) {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState
            importing={app.importing}
            onImport={importAndClose}
            onTrySample={() => void app.importSample()}
          />
        </div>
      );
    }
    return (
      <MainView
        key={app.importInfo?.at ?? ''}
        app={app}
        trails={trails}
        pending={pending}
        location={location}
        startLocation={start}
        onOpenSettings={() => setDialog('settings')}
      />
    );
  };

  return (
    <CacheMarksProvider marks={app}>
      <div
        data-testid="home"
        className="flex h-[100dvh] flex-col overflow-hidden"
      >
        <Header
          walking={walking}
          onOpenData={() => setDialog('data')}
          onOpenSettings={() => setDialog('settings')}
        />
        {app.error && (
          <ErrorNotice error={app.error} onDismiss={app.dismissError} />
        )}
        {app.lastImport && (
          <ImportSummary
            summary={app.lastImport}
            onDismiss={app.dismissImport}
          />
        )}
        <main
          id="main-content"
          className="relative flex min-h-0 flex-1 flex-col"
        >
          {screen()}
        </main>
        {dialog === 'settings' && (
          <SettingsDialog
            settings={app.settings}
            locallyFoundCount={app.locallyFound.size}
            ignored={ignored}
            onApply={app.applySettings}
            onResetLocallyFound={app.resetLocallyFound}
            onUnignore={app.unignore}
            onClose={close}
          />
        )}
        {app.pendingShare.length > 0 && (
          <SharedImportDialog
            files={app.pendingShare}
            onImport={() => void app.acceptShare()}
            onCancel={app.declineShare}
          />
        )}
        {dialog === 'data' && (
          <DataDialog
            cacheCount={app.caches.length}
            trailCount={trails.length}
            locallyFoundCount={app.locallyFound.size}
            ignoredCount={app.ignored.size}
            importInfo={app.importInfo}
            importing={app.importing}
            onImport={importAndClose}
            onClear={() => {
              close();
              void app.clearData();
            }}
            onClose={close}
          />
        )}
      </div>
    </CacheMarksProvider>
  );
}

/** The whole app: state from the hooks, one screen at a time, and the dialogs over it. */
export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
