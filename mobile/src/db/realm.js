import Realm from 'realm';

// Define the schema for the location data
const LocationSchema = {
  name: 'Location',
  properties: {
    _id: 'objectId',
    latitude: 'double',
    longitude: 'double',
    timestamp: 'date',
  },
  primaryKey: '_id',
};

let realm;

// Open a realm instance
export const openRealm = async () => {
  if (!realm || realm.isClosed) {
    realm = await Realm.open({
      schema: [LocationSchema],
      schemaVersion: 1,
    });
  }
  return realm;
};

// Close the realm instance
export const closeRealm = () => {
  if (realm && !realm.isClosed) {
    realm.close();
    realm = null;
  }
};

// Write location data to the realm
export const writeLocation = async (latitude, longitude, timestamp) => {
  const realmInstance = await openRealm();
  realmInstance.write(() => {
    realmInstance.create('Location', {
      _id: new Realm.BSON.ObjectID(),
      latitude,
      longitude,
      timestamp,
    });
  });
};

// Get all location data from the realm
export const getLocations = async () => {
  const realmInstance = await openRealm();
  return realmInstance.objects('Location');
};

// Delete all location data from the realm
export const deleteAllLocations = async () => {
  const realmInstance = await openRealm();
  realmInstance.write(() => {
    realmInstance.delete(realmInstance.objects('Location'));
  });
};
