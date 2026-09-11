const Cab = require('../models/Cab');

// @route   GET /api/cabs
// @desc    Get all available cabs with fare estimate
// @access  Public
const getCabs = async (req, res) => {
  try {
    const { distance } = req.query;
    let cabs = await Cab.find({ isAvailable: true }).populate('driver', 'name rating isOnline');

    if (distance) {
      cabs = cabs.map(cab => ({
        ...cab.toObject(),
        estimatedFare: cab.baseFare + (Number(distance) * cab.ratePerKm) + 5
      }));
    }

    res.json({ cabs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/cabs
// @desc    Add a new cab (admin)
// @access  Private (admin)
const addCab = async (req, res) => {
  try {
    const { name, type, seats, ratePerKm, baseFare, description, vehicleNumber, eta } = req.body;
    const iconMap = { bike: '🛵', auto: '🛺', mini: '🚗', sedan: '🚕', suv: '🚙' };

    const cab = await Cab.create({
      name,
      type,
      icon: iconMap[type] || '🚕',
      seats,
      ratePerKm,
      baseFare,
      description,
      vehicleNumber,
      eta
    });

    res.status(201).json({ message: 'Cab added successfully.', cab });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/cabs/:id
// @desc    Update cab
// @access  Private (admin)
const updateCab = async (req, res) => {
  try {
    const cab = await Cab.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cab) return res.status(404).json({ message: 'Cab not found.' });
    res.json({ message: 'Cab updated.', cab });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   DELETE /api/cabs/:id
// @desc    Delete cab
// @access  Private (admin)
const deleteCab = async (req, res) => {
  try {
    await Cab.findByIdAndDelete(req.params.id);
    res.json({ message: 'Cab deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Initialize default cabs if none exist
const seedCabs = async () => {
  const defaultCabs = [
    { name: 'Bike Taxi', type: 'bike', icon: '🛵', seats: 1, ratePerKm: 5, baseFare: 15, description: 'Fastest in traffic • 1 Helmet provided', eta: '2 min' },
    { name: 'Auto', type: 'auto', icon: '🛺', seats: 3, ratePerKm: 8, baseFare: 20, description: 'Economical & quick for 3', eta: '3 min' },
    { name: 'Mini', type: 'mini', icon: '🚗', seats: 4, ratePerKm: 12, baseFare: 30, description: 'Compact AC ride', eta: '4 min' },
    { name: 'Sedan', type: 'sedan', icon: '🚕', seats: 4, ratePerKm: 16, baseFare: 50, description: 'Comfortable AC sedan', eta: '5 min' },
    { name: 'SUV', type: 'suv', icon: '🚙', seats: 6, ratePerKm: 22, baseFare: 80, description: 'Spacious 6-seater', eta: '7 min' },
  ];

  for (const cab of defaultCabs) {
    const exists = await Cab.findOne({ type: cab.type });
    if (!exists) {
      await Cab.create(cab);
    }
  }
  console.log('✅ Default cabs verified/seeded.');
};

module.exports = { getCabs, addCab, updateCab, deleteCab, seedCabs };
