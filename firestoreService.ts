import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BookingMetric,
  BookingRecord,
  BookingStatus,
  BookingType,
  BrandCategory,
  clampStr,
  DEFAULT_CATALOG,
  InventoryItem,
  InventoryStatus,
  SCHEMA_LIMITS,
  UserPrivate,
  UserProfile,
} from '../types/domain';

function toDateOrNull(val: unknown): Date | null {
  if (val instanceof Timestamp) {
    return val.toDate();
  }
  return null;
}

function generateSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'doc';
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${cleanPrefix}_${ts}_${rand}`;
}

export function subscribeInventory(
  isBootstrapAdmin: boolean,
  onData: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'inventory');
  const q = isBootstrapAdmin ? query(colRef) : query(colRef, where('isPublished', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || ''),
          brand: (data.brand as BrandCategory) || 'iphone',
          brandLabel: String(data.brandLabel || ''),
          storage: String(data.storage || ''),
          color: String(data.color || ''),
          condition: String(data.condition || ''),
          price: Number(data.price || 0),
          stock: Number(data.stock || 0),
          status: (data.status as InventoryStatus) || 'in_stock',
          accessories: String(data.accessories || ''),
          imageUrl: String(data.imageUrl || ''),
          isPublished: Boolean(data.isPublished),
          updatedBy: String(data.updatedBy || ''),
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
        };
      });
      items.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'inventory');
      } catch (wrapped) {
        console.error(wrapped);
      }
    }
  );
}

export function subscribeUserProfiles(
  onData: (profiles: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'user_profiles'), where('isPublicProfile', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const profiles: UserProfile[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Customer'),
          avatarInitials: String(data.avatarInitials || 'U'),
          role: data.role === 'admin' ? 'admin' : 'customer',
          isPublicProfile: Boolean(data.isPublicProfile),
          totalBookings: Number(data.totalBookings || 0),
          completedBookings: Number(data.completedBookings || 0),
          cancelledBookings: Number(data.cancelledBookings || 0),
          tradeInCount: Number(data.tradeInCount || 0),
          totalProjectedValue: Number(data.totalProjectedValue || 0),
          preferredBrand: (data.preferredBrand as BrandCategory | 'all') || 'all',
          lastActiveAt: toDateOrNull(data.lastActiveAt),
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
        };
      });
      profiles.sort((a, b) => (b.lastActiveAt?.getTime() || 0) - (a.lastActiveAt?.getTime() || 0));
      onData(profiles);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'user_profiles');
      } catch (wrapped) {
        console.error(wrapped);
      }
    }
  );
}

export function subscribeBookingMetrics(
  onData: (metrics: BookingMetric[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'booking_metrics'), where('isPublicMetric', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const metrics: BookingMetric[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId || ''),
          bookingType: (data.bookingType as BookingType) || 'store_visit',
          brandCategory: (data.brandCategory as BrandCategory | 'general') || 'general',
          deviceTitle: String(data.deviceTitle || ''),
          estimatedValue: Number(data.estimatedValue || 0),
          appointmentDate: String(data.appointmentDate || ''),
          timeSlot: String(data.timeSlot || ''),
          status: (data.status as BookingStatus) || 'pending',
          isPublicMetric: Boolean(data.isPublicMetric),
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
        };
      });
      metrics.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(metrics);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'booking_metrics');
      } catch (wrapped) {
        console.error(wrapped);
      }
    }
  );
}

export function subscribeBookings(
  uid: string,
  isBootstrapAdmin: boolean,
  onData: (bookings: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'bookings');
  const q = isBootstrapAdmin ? query(colRef) : query(colRef, where('userId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const bookings: BookingRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId || ''),
          customerName: String(data.customerName || ''),
          customerPhone: String(data.customerPhone || ''),
          bookingType: (data.bookingType as BookingType) || 'store_visit',
          deviceId: String(data.deviceId || ''),
          deviceTitle: String(data.deviceTitle || ''),
          brandCategory: (data.brandCategory as BrandCategory | 'general') || 'general',
          tradeInDevice: String(data.tradeInDevice || ''),
          estimatedValue: Number(data.estimatedValue || 0),
          appointmentDate: String(data.appointmentDate || ''),
          timeSlot: String(data.timeSlot || ''),
          notes: String(data.notes || ''),
          status: (data.status as BookingStatus) || 'pending',
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
        };
      });
      bookings.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(bookings);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      } catch (wrapped) {
        console.error(wrapped);
      }
    }
  );
}

export async function seedDefaultInventory(adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  for (const item of DEFAULT_CATALOG) {
    const ref = doc(db, 'inventory', item.id);
    batch.set(ref, {
      name: clampStr(item.name, SCHEMA_LIMITS.NAME_MAX),
      brand: item.brand,
      brandLabel: clampStr(item.brandLabel, SCHEMA_LIMITS.SHORT_MAX),
      storage: clampStr(item.storage, SCHEMA_LIMITS.SHORT_MAX),
      color: clampStr(item.color, SCHEMA_LIMITS.SHORT_MAX),
      condition: clampStr(item.condition, SCHEMA_LIMITS.CONDITION_MAX),
      price: Math.max(0, Math.min(SCHEMA_LIMITS.MAX_PRICE, Number(item.price))),
      stock: Math.max(0, Math.min(SCHEMA_LIMITS.MAX_STOCK, Math.round(item.stock))),
      status: item.status,
      accessories: clampStr(item.accessories, SCHEMA_LIMITS.ACCESSORIES_MAX),
      imageUrl: clampStr(item.imageUrl, SCHEMA_LIMITS.IMAGE_URL_MAX),
      isPublished: true,
      updatedBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'inventory');
  }
}

export interface InventoryFormPayload {
  name: string;
  brand: BrandCategory;
  brandLabel: string;
  storage: string;
  color: string;
  condition: string;
  price: number;
  stock: number;
  status: InventoryStatus;
  accessories: string;
  imageUrl: string;
  isPublished: boolean;
}

export async function createInventoryItem(
  payload: InventoryFormPayload,
  adminUid: string
): Promise<string> {
  const id = generateSafeId(payload.brand);
  const ref = doc(db, 'inventory', id);
  const stockNum = Math.max(0, Math.min(SCHEMA_LIMITS.MAX_STOCK, Math.round(payload.stock)));
  const derivedStatus: InventoryStatus =
    stockNum === 0 && payload.status !== 'reserved'
      ? 'out_of_stock'
      : stockNum <= 2 && payload.status === 'in_stock'
      ? 'low_stock'
      : payload.status;

  try {
    await setDoc(ref, {
      name: clampStr(payload.name, SCHEMA_LIMITS.NAME_MAX) || 'Smartphone',
      brand: payload.brand,
      brandLabel: clampStr(payload.brandLabel, SCHEMA_LIMITS.SHORT_MAX) || 'Brand',
      storage: clampStr(payload.storage, SCHEMA_LIMITS.SHORT_MAX) || '128GB',
      color: clampStr(payload.color, SCHEMA_LIMITS.SHORT_MAX) || 'Obsidian',
      condition: clampStr(payload.condition, SCHEMA_LIMITS.CONDITION_MAX) || 'Mint',
      price: Math.max(0, Math.min(SCHEMA_LIMITS.MAX_PRICE, Number(payload.price) || 0)),
      stock: stockNum,
      status: derivedStatus,
      accessories: clampStr(payload.accessories, SCHEMA_LIMITS.ACCESSORIES_MAX),
      imageUrl: clampStr(payload.imageUrl, SCHEMA_LIMITS.IMAGE_URL_MAX),
      isPublished: Boolean(payload.isPublished),
      updatedBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `inventory/${id}`);
  }
}

export async function updateInventoryItem(
  itemId: string,
  payload: Partial<InventoryFormPayload>,
  adminUid: string
): Promise<void> {
  const ref = doc(db, 'inventory', itemId);
  const updateData: Record<string, unknown> = {
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  };

  if (payload.name !== undefined) updateData.name = clampStr(payload.name, SCHEMA_LIMITS.NAME_MAX);
  if (payload.brand !== undefined) updateData.brand = payload.brand;
  if (payload.brandLabel !== undefined) updateData.brandLabel = clampStr(payload.brandLabel, SCHEMA_LIMITS.SHORT_MAX);
  if (payload.storage !== undefined) updateData.storage = clampStr(payload.storage, SCHEMA_LIMITS.SHORT_MAX);
  if (payload.color !== undefined) updateData.color = clampStr(payload.color, SCHEMA_LIMITS.SHORT_MAX);
  if (payload.condition !== undefined) updateData.condition = clampStr(payload.condition, SCHEMA_LIMITS.CONDITION_MAX);
  if (payload.price !== undefined) {
    updateData.price = Math.max(0, Math.min(SCHEMA_LIMITS.MAX_PRICE, Number(payload.price) || 0));
  }
  if (payload.stock !== undefined) {
    updateData.stock = Math.max(0, Math.min(SCHEMA_LIMITS.MAX_STOCK, Math.round(payload.stock)));
  }
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.accessories !== undefined) updateData.accessories = clampStr(payload.accessories, SCHEMA_LIMITS.ACCESSORIES_MAX);
  if (payload.imageUrl !== undefined) updateData.imageUrl = clampStr(payload.imageUrl, SCHEMA_LIMITS.IMAGE_URL_MAX);
  if (payload.isPublished !== undefined) updateData.isPublished = Boolean(payload.isPublished);

  try {
    await updateDoc(ref, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `inventory/${itemId}`);
  }
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'inventory', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `inventory/${itemId}`);
  }
}

export interface CreateBookingPayload {
  userId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  bookingType: BookingType;
  deviceId: string;
  deviceTitle: string;
  brandCategory: BrandCategory | 'general';
  tradeInDevice: string;
  estimatedValue: number;
  appointmentDate: string;
  timeSlot: string;
  notes: string;
  isAdminUser?: boolean;
}

export async function createBooking(payload: CreateBookingPayload): Promise<string> {
  const bookingId = generateSafeId('bk');
  const bookingRef = doc(db, 'bookings', bookingId);
  const metricRef = doc(db, 'booking_metrics', bookingId);
  const profileRef = doc(db, 'user_profiles', payload.userId);
  const privateRef = doc(db, 'user_private', payload.userId);

  const safeValue = Math.max(0, Math.min(SCHEMA_LIMITS.MAX_PRICE, Math.round(Number(payload.estimatedValue) || 0)));
  const safeName = clampStr(payload.customerName, SCHEMA_LIMITS.CUSTOMER_NAME_MAX) || 'Customer';
  const safePhone = clampStr(payload.customerPhone, SCHEMA_LIMITS.PHONE_MAX);
  const safeDate = SCHEMA_LIMITS.DATE_PATTERN.test(payload.appointmentDate)
    ? payload.appointmentDate
    : new Date().toISOString().slice(0, 10);

  const isTradeIn = payload.bookingType === 'sell_device' || payload.bookingType === 'exchange_upgrade';

  // Ensure user_profiles exists before updating its counters in the batch
  try {
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      const parts = safeName.split(/\s+/).filter(Boolean);
      const initials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : safeName.slice(0, 2).toUpperCase() || 'U';
      await setDoc(profileRef, {
        uid: payload.userId,
        displayName: safeName,
        avatarInitials: initials,
        role: payload.isAdminUser ? 'admin' : 'customer',
        isPublicProfile: true,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        tradeInCount: 0,
        totalProjectedValue: 0,
        preferredBrand: 'all',
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `user_profiles/${payload.userId}`);
  }

  const batch = writeBatch(db);
  batch.set(bookingRef, {
    userId: payload.userId,
    customerName: safeName,
    customerPhone: safePhone,
    bookingType: payload.bookingType,
    deviceId: clampStr(payload.deviceId, SCHEMA_LIMITS.ID_MAX),
    deviceTitle: clampStr(payload.deviceTitle, SCHEMA_LIMITS.DEVICE_TITLE_MAX),
    brandCategory: payload.brandCategory,
    tradeInDevice: clampStr(payload.tradeInDevice, SCHEMA_LIMITS.DEVICE_TITLE_MAX),
    estimatedValue: safeValue,
    appointmentDate: safeDate,
    timeSlot: clampStr(payload.timeSlot, SCHEMA_LIMITS.SHORT_MAX),
    notes: clampStr(payload.notes, SCHEMA_LIMITS.NOTES_MAX),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(metricRef, {
    userId: payload.userId,
    bookingType: payload.bookingType,
    brandCategory: payload.brandCategory,
    deviceTitle: clampStr(payload.deviceTitle, SCHEMA_LIMITS.DEVICE_TITLE_MAX),
    estimatedValue: safeValue,
    appointmentDate: safeDate,
    timeSlot: clampStr(payload.timeSlot, SCHEMA_LIMITS.SHORT_MAX),
    status: 'pending',
    isPublicMetric: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(profileRef, {
    totalBookings: increment(1),
    tradeInCount: increment(isTradeIn ? 1 : 0),
    totalProjectedValue: increment(safeValue),
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
  }

  // Sync private phone number safely after booking succeeds
  if (safePhone.length >= 7) {
    try {
      const privSnap = await getDoc(privateRef);
      if (privSnap.exists()) {
        await updateDoc(privateRef, {
          phone: safePhone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(privateRef, {
          uid: payload.userId,
          email: clampStr(payload.customerEmail || 'user@a1mobile.local', 160),
          phone: safePhone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (privErr) {
      console.warn('Could not sync private phone number:', privErr);
    }
  }

  return bookingId;
}

export async function cancelOwnBooking(booking: BookingRecord): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'bookings', booking.id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'booking_metrics', booking.id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });

  const profileSnap = await getDoc(doc(db, 'user_profiles', booking.userId));
  if (profileSnap.exists()) {
    batch.update(doc(db, 'user_profiles', booking.userId), {
      cancelledBookings: increment(1),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
  }
}

export async function updateBookingStatusAdmin(
  booking: BookingRecord,
  newStatus: BookingStatus
): Promise<void> {
  if (booking.status === newStatus) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'bookings', booking.id), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'booking_metrics', booking.id), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  const profileSnap = await getDoc(doc(db, 'user_profiles', booking.userId));
  if (profileSnap.exists()) {
    const profileUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (newStatus === 'completed' && booking.status !== 'completed') {
      profileUpdates.completedBookings = increment(1);
    }
    if (newStatus === 'cancelled' && booking.status !== 'cancelled') {
      profileUpdates.cancelledBookings = increment(1);
    }
    batch.update(doc(db, 'user_profiles', booking.userId), profileUpdates);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
  }
}

export async function fetchUserPrivate(uid: string): Promise<UserPrivate | null> {
  try {
    const snap = await getDoc(doc(db, 'user_private', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid || uid),
      email: String(data.email || ''),
      phone: String(data.phone || ''),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `user_private/${uid}`);
  }
}

export async function updatePreferredBrand(uid: string, brand: BrandCategory | 'all'): Promise<void> {
  try {
    await updateDoc(doc(db, 'user_profiles', uid), {
      preferredBrand: brand,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `user_profiles/${uid}`);
  }
}
