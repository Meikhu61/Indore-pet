import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Minus,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createInventoryItem,
  deleteInventoryItem,
  InventoryFormPayload,
  seedDefaultInventory,
  updateInventoryItem,
} from '../services/firestoreService';
import {
  BrandCategory,
  formatINR,
  InventoryItem,
  InventoryStatus,
  STUDIO_IMAGE_PRESETS,
} from '../types/domain';
import { DeviceImage } from './DeviceImage';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  loading: boolean;
  isLiveSynced: boolean;
  onBookDevice: (item: InventoryItem) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const EMPTY_FORM: InventoryFormPayload = {
  name: '',
  brand: 'iphone',
  brandLabel: 'Apple iPhone',
  storage: '256GB',
  color: 'Natural Titanium',
  condition: 'Mint · 96% Battery',
  price: 75000,
  stock: 2,
  status: 'in_stock',
  accessories: 'Box + Original Cable',
  imageUrl: STUDIO_IMAGE_PRESETS[0].url,
  isPublished: true,
};

const BRAND_LABEL_MAP: Record<BrandCategory, string> = {
  iphone: 'Apple iPhone',
  samsung: 'Samsung',
  android: 'OnePlus / Android',
};

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventory,
  loading,
  isLiveSynced,
  onBookDevice,
  onNotify,
}) => {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<BrandCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>('all');

  // Modal state for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formState, setFormState] = useState<InventoryFormPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Inline price editing state
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const stats = useMemo(() => {
    const totalSkus = inventory.length;
    const totalUnits = inventory.reduce((acc, i) => acc + i.stock, 0);
    const totalValue = inventory.reduce((acc, i) => acc + i.price * i.stock, 0);
    const lowOrEmpty = inventory.filter((i) => i.stock <= 2 || i.status === 'out_of_stock').length;
    return { totalSkus, totalUnits, totalValue, lowOrEmpty };
  }, [inventory]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.storage.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        item.brandLabel.toLowerCase().includes(q);
      return matchesBrand && matchesStatus && matchesSearch;
    });
  }, [inventory, searchQuery, brandFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormState(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormState({
      name: item.name,
      brand: item.brand,
      brandLabel: item.brandLabel,
      storage: item.storage,
      color: item.color,
      condition: item.condition,
      price: item.price,
      stock: item.stock,
      status: item.status,
      accessories: item.accessories,
      imageUrl: item.imageUrl,
      isPublished: item.isPublished,
    });
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setSaving(true);
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, formState, user.uid);
        onNotify('success', `${formState.name} updated.`);
      } else {
        await createInventoryItem(formState, user.uid);
        onNotify('success', `${formState.name} added to live inventory.`);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      onNotify('error', 'Failed to save inventory item.');
    } finally {
      setSaving(false);
    }
  };

  const handleStockStep = async (item: InventoryItem, delta: number) => {
    if (!user || !isAdmin) return;
    const nextStock = Math.max(0, item.stock + delta);
    const nextStatus: InventoryStatus =
      nextStock === 0
        ? 'out_of_stock'
        : nextStock <= 2
        ? 'low_stock'
        : item.status === 'out_of_stock' || item.status === 'low_stock'
        ? 'in_stock'
        : item.status;

    setBusyId(item.id);
    try {
      await updateInventoryItem(
        item.id,
        { stock: nextStock, status: nextStatus },
        user.uid
      );
    } catch (err) {
      console.error(err);
      onNotify('error', 'Could not update stock count.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInlinePriceSave = async (item: InventoryItem) => {
    if (!user || !isAdmin) return;
    const raw = priceEdits[item.id];
    if (raw === undefined) return;
    const parsed = Number(raw);
    if (Number.isNaN(parsed) || parsed < 0) {
      onNotify('error', 'Enter a valid non-negative price.');
      return;
    }
    setBusyId(item.id);
    try {
      await updateInventoryItem(item.id, { price: parsed }, user.uid);
      setPriceEdits((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      onNotify('success', `Price updated for ${item.name}.`);
    } catch (err) {
      console.error(err);
      onNotify('error', 'Could not update price.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (item: InventoryItem, status: InventoryStatus) => {
    if (!user || !isAdmin) return;
    setBusyId(item.id);
    try {
      await updateInventoryItem(item.id, { status }, user.uid);
      onNotify('success', `Status updated for ${item.name}.`);
    } catch (err) {
      console.error(err);
      onNotify('error', 'Could not change status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!user || !isAdmin) return;
    setBusyId(item.id);
    try {
      await deleteInventoryItem(item.id);
      setConfirmDeleteId(null);
      onNotify('info', `${item.name} removed from inventory.`);
    } catch (err) {
      console.error(err);
      onNotify('error', 'Failed to delete item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    if (!user || !isAdmin) return;
    setSeeding(true);
    try {
      await seedDefaultInventory(user.uid);
      onNotify('success', 'Default A1 MOBILE catalog seeded to Firestore.');
    } catch (err) {
      console.error(err);
      onNotify('error', 'Failed to seed catalog.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Real-Time Stock Ledger
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
            Inventory Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && !isLiveSynced && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-100 hover:border-amber-400 transition cursor-pointer disabled:opacity-60"
            >
              {seeding ? 'Syncing...' : 'Sync Default Stock to DB'}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-xl gold-gradient-bg text-zinc-950 font-bold text-xs hover:brightness-110 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Smartphone
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-xl bg-[#121216] border border-zinc-800 px-4 py-3 flex items-center gap-3 text-xs text-zinc-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Live read-only stock view. Creating, editing prices, adjusting stock quantities, and deleting items are restricted to verified Store Admin accounts.
          </span>
        </div>
      )}

      {/* Inventory Valuation Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5">
          <p className="text-xs text-zinc-400">Total Models (SKUs)</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">{stats.totalSkus}</p>
        </div>
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5">
          <p className="text-xs text-zinc-400">Total Units Available</p>
          <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">{stats.totalUnits}</p>
        </div>
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5">
          <p className="text-xs text-zinc-400">Catalog Valuation</p>
          <p className="font-mono text-2xl font-bold text-amber-300 tabular-nums mt-1">
            {formatINR(stats.totalValue)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#121216] border border-zinc-800 p-5">
          <p className="text-xs text-zinc-400">Low / Out-of-Stock</p>
          <p className="font-mono text-2xl font-bold text-zinc-100 tabular-nums mt-1">{stats.lowOrEmpty}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by model, storage, or color..."
            aria-label="Filter inventory"
            className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-[#121216] border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by brand"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value as BrandCategory | 'all')}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#121216] border border-zinc-800 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Brands</option>
            <option value="iphone">Apple iPhone</option>
            <option value="samsung">Samsung</option>
            <option value="android">OnePlus / Android</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InventoryStatus | 'all')}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#121216] border border-zinc-800 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="reserved">Reserved</option>
          </select>
        </div>
      </div>

      {/* Editable Inventory Table */}
      <div className="rounded-2xl bg-[#121216] border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-zinc-900/70 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-base font-semibold text-zinc-200">No inventory items match</p>
            <p className="text-sm text-zinc-400">Adjust your search filters or add a new smartphone.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-950/60">
                  <th className="py-3.5 px-5 font-semibold">Device</th>
                  <th className="py-3.5 px-4 font-semibold">Specs & Condition</th>
                  <th className="py-3.5 px-4 font-semibold">Price (INR)</th>
                  <th className="py-3.5 px-4 font-semibold">Stock Qty</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-xs">
                {filteredItems.map((item) => {
                  const isBusy = busyId === item.id;
                  const editingPriceVal = priceEdits[item.id];
                  const hasDirtyPrice =
                    editingPriceVal !== undefined && Number(editingPriceVal) !== item.price;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                            <DeviceImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-white truncate">{item.name}</p>
                            <p className="text-[11px] text-zinc-400">
                              {item.brandLabel} {!item.isPublished && '· Hidden'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[190px]">
                        <p className="text-zinc-200 font-medium">
                          {item.storage} · {item.color}
                        </p>
                        <p className="text-zinc-400 mt-0.5">{item.condition}</p>
                      </td>

                      <td className="py-4 px-4 min-w-[160px]">
                        {isAdmin && isLiveSynced ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={10000000}
                              aria-label={`Price for ${item.name}`}
                              value={editingPriceVal !== undefined ? editingPriceVal : item.price}
                              onChange={(e) =>
                                setPriceEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleInlinePriceSave(item);
                              }}
                              className="w-28 min-h-[34px] px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 font-mono tabular-nums text-xs text-amber-300 focus:border-amber-400 focus:outline-none"
                            />
                            {hasDirtyPrice && (
                              <button
                                type="button"
                                disabled={isBusy}
                                aria-label="Save price"
                                onClick={() => void handleInlinePriceSave(item)}
                                className="p-2 rounded-lg bg-amber-400 text-zinc-950 hover:brightness-110 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono tabular-nums text-sm font-semibold text-amber-300">
                            {formatINR(item.price)}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 min-w-[130px]">
                        {isAdmin && isLiveSynced ? (
                          <div className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                            <button
                              type="button"
                              disabled={isBusy || item.stock === 0}
                              aria-label={`Decrease stock for ${item.name}`}
                              onClick={() => void handleStockStep(item, -1)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono tabular-nums font-bold text-white">
                              {item.stock}
                            </span>
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Increase stock for ${item.name}`}
                              onClick={() => void handleStockStep(item, 1)}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono tabular-nums text-zinc-100 font-semibold">
                            {item.stock} units
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 min-w-[140px]">
                        {isAdmin && isLiveSynced ? (
                          <select
                            aria-label={`Status for ${item.name}`}
                            disabled={isBusy}
                            value={item.status}
                            onChange={(e) =>
                              void handleStatusChange(item, e.target.value as InventoryStatus)
                            }
                            className="min-h-[34px] px-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
                          >
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                            <option value="reserved">Reserved</option>
                          </select>
                        ) : (
                          <span
                            className={`font-medium ${
                              item.status === 'out_of_stock'
                                ? 'text-red-400'
                                : item.status === 'low_stock'
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right min-w-[150px]">
                        {isAdmin && isLiveSynced ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              aria-label={`Edit ${item.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-amber-400 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>

                            {confirmDeleteId === item.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDelete(item)}
                                  className="px-2.5 py-1.5 min-h-[34px] rounded-lg bg-red-500 text-white font-semibold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="p-1.5 min-h-[34px] rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Delete ${item.name}`}
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-2 min-h-[34px] rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/60 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={item.stock === 0}
                            onClick={() => onBookDevice(item)}
                            className="px-3.5 py-1.5 min-h-[34px] rounded-lg gold-gradient-bg text-zinc-950 font-bold text-xs hover:brightness-110 transition cursor-pointer disabled:opacity-40"
                          >
                            Reserve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Item Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inv-modal-title"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#121216] border border-zinc-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 id="inv-modal-title" className="font-display text-2xl font-bold text-white">
                {editingItem ? `Edit ${editingItem.name}` : 'Add New Smartphone'}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="m-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Model Name *
                  </label>
                  <input
                    id="m-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., iPhone 15 Pro Max"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-brand" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Brand Category
                  </label>
                  <select
                    id="m-brand"
                    value={formState.brand}
                    onChange={(e) => {
                      const brand = e.target.value as BrandCategory;
                      setFormState((p) => ({
                        ...p,
                        brand,
                        brandLabel: BRAND_LABEL_MAP[brand],
                      }));
                    }}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="iphone">Apple iPhone</option>
                    <option value="samsung">Samsung</option>
                    <option value="android">OnePlus / Android</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="m-storage" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Storage *
                  </label>
                  <input
                    id="m-storage"
                    type="text"
                    required
                    value={formState.storage}
                    onChange={(e) => setFormState((p) => ({ ...p, storage: e.target.value }))}
                    placeholder="256GB"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-color" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Color Finish *
                  </label>
                  <input
                    id="m-color"
                    type="text"
                    required
                    value={formState.color}
                    onChange={(e) => setFormState((p) => ({ ...p, color: e.target.value }))}
                    placeholder="Natural Titanium"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-status" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Status
                  </label>
                  <select
                    id="m-status"
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, status: e.target.value as InventoryStatus }))
                    }
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="m-price" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Price (INR) *
                  </label>
                  <input
                    id="m-price"
                    type="number"
                    required
                    min={0}
                    max={10000000}
                    value={formState.price}
                    onChange={(e) => setFormState((p) => ({ ...p, price: Number(e.target.value) }))}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono tabular-nums text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-stock" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Stock Quantity *
                  </label>
                  <input
                    id="m-stock"
                    type="number"
                    required
                    min={0}
                    max={10000}
                    value={formState.stock}
                    onChange={(e) => setFormState((p) => ({ ...p, stock: Number(e.target.value) }))}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-mono tabular-nums text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="m-cond" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Condition & Battery *
                  </label>
                  <input
                    id="m-cond"
                    type="text"
                    required
                    value={formState.condition}
                    onChange={(e) => setFormState((p) => ({ ...p, condition: e.target.value }))}
                    placeholder="Mint · 96% Battery"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="m-acc" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Included Accessories
                  </label>
                  <input
                    id="m-acc"
                    type="text"
                    value={formState.accessories}
                    onChange={(e) => setFormState((p) => ({ ...p, accessories: e.target.value }))}
                    placeholder="Box + Original Cable"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="m-photo" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Product Photo Preset
                </label>
                <select
                  id="m-photo"
                  value={formState.imageUrl}
                  onChange={(e) => setFormState((p) => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  {STUDIO_IMAGE_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formState.isPublished}
                  onChange={(e) => setFormState((p) => ({ ...p, isPublished: e.target.checked }))}
                  className="w-4 h-4 rounded accent-amber-400"
                />
                Visible on public storefront catalog
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 min-h-[42px] rounded-xl gold-gradient-bg text-zinc-950 font-bold text-xs hover:brightness-110 transition cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
