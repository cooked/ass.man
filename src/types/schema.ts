export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date' | 'relation' | 'array';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
  targetAsset?: string;
  description?: string;
}

export interface RelationDefinition {
  type: 'belongsTo' | 'hasOne' | 'hasMany';
  targetAsset: string;
  foreignKey: string;
  label: string;
}

export interface AssetSchema {
  $schema?: string;
  entity: string;
  id?: string;
  label: string;
  pluralLabel?: string;
  title?: string;
  singular?: string;
  plural?: string;
  icon?: string;
  primaryKey?: string;
  identityField?: string;
  properties?: Record<string, any>;
  fields?: FieldDefinition[];
  relations?: Record<string, RelationDefinition>;
}

export interface ViewColumnDefinition {
  field: string;
  label: string;
  width?: number;
  pinned?: boolean;
  renderer?: 'text' | 'mono-badge' | 'type-pill' | 'status-badge' | 'code-pill' | 'relation-link' | 'date' | 'number';
  fallback?: string;
}

export interface QuickFilter {
  id: string;
  label: string;
  predicate?: Record<string, any>;
}

export interface ViewDefinition {
  id: string;
  title: string;
  shortTitle?: string;
  targetAsset: string;
  icon?: string;
  renderer: 'spreadsheet-grid' | 'kit-manager' | 'customers-map' | 'users-manager' | 'firmware-manager' | 'generic';
  description?: string;
  config?: {
    searchable?: boolean;
    virtualized?: boolean;
    defaultSort?: { field: string; order: 'asc' | 'desc' };
    columns?: ViewColumnDefinition[];
    quickFilters?: QuickFilter[];
    initialCenter?: [number, number];
    initialZoom?: number;
    allowQuickAssign?: boolean;
    showSensorsPool?: boolean;
    [key: string]: any;
  };
}

export interface GenericAsset {
  [key: string]: any;
  _lock?: {
    userId: string;
    userName: string;
    lockedAt: string;
    expiresAt: string;
  };
  _resolved?: Record<string, any>;
}

export interface GearAsset extends GenericAsset {
  code: string;
  name: string;
  category: string;
  owner_id?: string;
  condition: string;
  weight_kg: number;
  status: string;
}

export interface AdventureSlot {
  slotId: number;
  requiredType: string;
  filledWithSerial: string;
  isFilled: boolean;
}

export interface AdventureAsset extends GenericAsset {
  adventure_code: string;
  title: string;
  destination_id?: string;
  organizer_id?: string;
  date?: string;
  difficulty?: string;
  status: string;
  expected_spec?: string;
  slots?: AdventureSlot[];
}

export interface PlaceAsset extends GenericAsset {
  id: string;
  title: string;
  category: string;
  city: string;
  latitude: number;
  longitude: number;
  rating?: number;
  best_season?: string;
  description?: string;
}

export interface PersonAsset extends GenericAsset {
  id: string;
  name: string;
  nickname?: string;
  role?: string;
  email?: string;
  avatar_color?: string;
  status?: string;
  favorite_activity?: string;
}

export interface SensorAsset extends GenericAsset {
  serial_number: string;
  sensor_type: string;
  hw_version: string;
  fw_version: string;
  status: string;
  kit_id?: string;
  customer_id?: string;
  scan_date?: string;
  notes?: string;
  [key: string]: any;
}

export interface KitAsset extends GenericAsset {
  kit_code: string;
  kit_name: string;
  target_machine?: string;
  customer_id?: string;
  status: string;
  expected_spec?: string;
  creation_date?: string;
  notes?: string;
  slots?: any[];
  [key: string]: any;
}

export interface CustomerAsset extends GenericAsset {
  code?: string;
  id?: string;
  company_name?: string;
  title?: string;
  plant_name?: string;
  address?: string;
  city?: string;
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  contact_person?: string;
  contact_email?: string;
  phone?: string;
  [key: string]: any;
}

export interface FirmwareAsset extends GenericAsset {
  fw_code: string;
  version: string;
  sensor_type: string;
  status: string;
  min_hw_version?: string;
  release_date?: string;
  checksum?: string;
  changelog?: string;
  [key: string]: any;
}

