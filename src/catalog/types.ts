export interface Structure {
  id: string;
  presentationType: string;
  objective: string;
  roles: { role: string; flexible: boolean }[];
}

export interface AnimationPreset {
  id: string;
  name: string;
}

export interface TransitionPreset {
  id: string;
  name: string;
}

export interface Catalog {
  structures: Structure[];
  animations: AnimationPreset[];
  transitions: TransitionPreset[];
}
