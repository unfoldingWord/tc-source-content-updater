# source-content-updater
Resource Updating Module For tC

# Development


# Usage
To use this module you must first create a new instance of the object.
i.e.
```
import updater from 'source-content-updater';
const Updater = new updater();
```

Note: In order to limit the amount of API calls the door43 repo, the Updater object uses the same catalog resource throughout its lifetime, without having to continuosly do requests to door43 API on each function call.

## Workflow
1. Create instance
2. Fetch latest resources
3. Download the resources that are not updated

## Updater Object
**`getLatestsResourceDates(update, resourceList)`**: 
- **description** -
Used to initiate a load of the latests resource so that the user can then select which ones
they would like to update. This function only returns the resources that already up to date on the user machine
- @param {boolean} **update** - indicates whether the latest catalog should be updated
before the request

- @param {Array} **resourceList** - list of resources that are on the users local machine already

- @return {Promise} - Array of resources and their corresponding time stamps

**`updateCatalog()`**:
- **description** - Method to manually fetch the latest catalog for the current
Updater instance. This function has no return value

**`downloadResources(resourceList)`**:
- **description** - Method to manually fetch the latest catalog for the current
Updater instance. This function has no return value
- @param {Array} **resourceList** - list of resources that you would like to download
- @return {Promise} Array of updated content from the specified resource list

