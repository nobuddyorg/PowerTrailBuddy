import { type Page } from '@playwright/test';

import { initBottomSheet } from './bottom-sheet';
import { initCacheDetails } from './cache-details';
import { initDataDialog } from './data-dialog';
import { initEmptyState } from './empty-state';
import { initHome } from './home';
import { initMap } from './map';
import { initSettings } from './settings';
import { initSharedImport } from './shared-import';
import { initToast } from './toast';
import { initTrailDetail } from './trail-detail';
import { initTrailList } from './trail-list';
import { initWalk } from './walk';

/** Getters, so a spec that wants one screen builds only that screen's locators. */
export function createPageTree(page: Page) {
  return {
    get bottomSheet() {
      return initBottomSheet(page);
    },
    get cache() {
      return initCacheDetails(page);
    },
    get data() {
      return initDataDialog(page);
    },
    get emptyState() {
      return initEmptyState(page);
    },
    get home() {
      return initHome(page);
    },
    get map() {
      return initMap(page);
    },
    get settings() {
      return initSettings(page);
    },
    get sharedImport() {
      return initSharedImport(page);
    },
    get toast() {
      return initToast(page);
    },
    get trail() {
      return initTrailDetail(page);
    },
    get trails() {
      return initTrailList(page);
    },
    get walk() {
      return initWalk(page);
    },
  };
}
