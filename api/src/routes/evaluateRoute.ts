import { Router } from 'express';
import { evaluate_URL } from '../main'; // Replace with the correct module path
import { getRepository } from 'typeorm';
import { PackageMetaData } from '../entities/packageMetaData';
import { PackageMetrics } from '../entities/packageMetrics';

const evaluateRoute = Router();

evaluateRoute.post('/evaluate', async (req, res) => {
  try {
    const { url } = req.body; // Assuming the URL is sent in the request body

    // Call the evaluate_URL function
    const metrics = await evaluate_URL(url);

    // If you want to store the metrics in the database (optional)
    const packageMetaDataRepository = getRepository(PackageMetaData);
    const packageMetaData = await packageMetaDataRepository.findOne({ where: { package_url: url } });

    if (packageMetaData) {
        const packageMetricsRepository = getRepository(PackageMetrics);
        const packageMetrics = new PackageMetrics();
        packageMetrics.packageMetaData = packageMetaData;
        Object.assign(packageMetrics, metrics);
        await packageMetricsRepository.save(packageMetrics);
    }

    res.status(200).json(metrics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default evaluateRoute;
