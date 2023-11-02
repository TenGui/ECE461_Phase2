import { Router } from 'express';
import { getRepository } from 'typeorm';
import { Package } from '../entities/package';
import { PackageMetaData } from '../entities/packageMetaData';
import { PackageHistory } from '../entities/packageHistory';

const updateRoute = Router();

updateRoute.post('/update', async (req, res) => {
  try {
    // Validate and authenticate the user as needed
    
    const { user_name, package_id, package_version, package_zip } = req.body;

    // Check if the package exists
    const packageRepository = getRepository(Package);
    const packageObj = await packageRepository.findOne({
      where: { package_id, package_version },
    });

    if (!packageObj) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Update the package zip content
    packageObj.package_zip = package_zip;
    await packageRepository.save(packageObj);

    // Log the update action in the history
    const packageHistoryRepository = getRepository(PackageHistory);
    const packageHistory = new PackageHistory();
    packageHistory.user_name = user_name;
    packageHistory.user_action = 'update';
    packageHistory.package_id = package_id;
    await packageHistoryRepository.save(packageHistory);

    res.status(200).json({ message: 'Package updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default updateRoute;