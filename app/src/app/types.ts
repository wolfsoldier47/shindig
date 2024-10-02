export interface ILocation {
    name: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
}

export interface ITag {
    name: string;
    description: string;
    fontColor: string;
    backgroundColor: string;
}

export interface IUser {
    uid: string;
    email: string;
    displayName: string | null;
    createdAt: Date;
}

export interface IOrganizer {
    name: string;
    subtitle?: string;
    profilePictureUri?: string;
    bannerUri?: string;
    officialPageUrls: string[];
    description: string;

    // This is only used for deciding who can edit/delete stuff. Not for public display.
    leaders: IUser[];
    commitees: IUser[];
    subscribers: IUser[];

    isInactive?: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export interface IEvent {
    title: string;
    subtitle?: string;
    description: string;

    startDatetime: Date;
    endDatetime?: Date;
    eventLinks: string[];
    organizerIds: string[];
    bannerUri?: string;
    locationId: string;

    tagIds: string[];
    isWalkInAvailable: boolean;
    isConfirmed: boolean;

    createdAt: Date;
    updatedAt: Date;
}
