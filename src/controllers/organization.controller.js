import { Organization } from '../models/Organization.js';
import { AuditService } from '../services/audit.service.js';
import logger from '../config/logger.js';

export async function createOrganization(req, res) {
  try {
    const { name, email, phone, plan = 'free', adminId } = req.body;
    const user = req.user;

    // Validation
    if (!name || !email || !adminId) {
      return res.status(400).json({ error: 'name, email, adminId sont requeridos' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check if slug already exists
    const existing = await Organization.findOne({ slug });
    if (existing) {
      return res.status(400).json({ error: 'Una organización con ese nombre ya existe' });
    }

    // Create organization with plan limits
    const maxLeaders = plan === 'free' ? 10 : (plan === 'pro' ? 100 : 10000);
    const maxEvents = plan === 'free' ? 5 : (plan === 'pro' ? 50 : 10000);
    const maxRegistrationsPerEvent = plan === 'free' ? 500 : (plan === 'pro' ? 5000 : 100000);

    const org = new Organization({
      name,
      slug,
      email,
      phone,
      adminId,
      plan,
      status: 'active',
      maxLeaders,
      maxEvents,
      maxRegistrationsPerEvent,
      leadersCount: 0,
      eventsCount: 0,
      registrationsCount: 0
    });

    await org.save();

    await AuditService.log(
      'CREATE',
      'Organization',
      org._id.toString(),
      user,
      { name, plan },
      `Organización ${name} creada`,
      req
    );

    logger.info('Organization created', { orgId: org._id, name });
    res.status(201).json(org);
  } catch (error) {
    logger.error('Create organization error:', { error: error.message });
    res.status(400).json({ error: 'Error al crear organización' });
  }
}

export async function getOrganizations(req, res) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    res.json(orgs);
  } catch (error) {
    logger.error('Get organizations error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener organizaciones' });
  }
}

export async function getOrganizationDetails(req, res) {
  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);

    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    res.json(org);
  } catch (error) {
    logger.error('Get organization error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener organización' });
  }
}

export async function updateOrganization(req, res) {
  try {
    const { orgId } = req.params;
    const { name, email, phone, plan, status } = req.body;
    const user = req.user;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Track changes for audit
    const changes = {};
    if (name !== undefined && name !== org.name) {
      changes.name = { old: org.name, new: name };
      org.name = name;
    }
    if (email !== undefined && email !== org.email) {
      changes.email = { old: org.email, new: email };
      org.email = email;
    }
    if (phone !== undefined && phone !== org.phone) {
      changes.phone = { old: org.phone, new: phone };
      org.phone = phone;
    }
    if (plan !== undefined && plan !== org.plan) {
      changes.plan = { old: org.plan, new: plan };
      org.plan = plan;
      // Update limits based on plan
      org.maxLeaders = plan === 'free' ? 10 : (plan === 'pro' ? 100 : 10000);
      org.maxEvents = plan === 'free' ? 5 : (plan === 'pro' ? 50 : 10000);
      org.maxRegistrationsPerEvent = plan === 'free' ? 500 : (plan === 'pro' ? 5000 : 100000);
    }
    if (status !== undefined && status !== org.status) {
      changes.status = { old: org.status, new: status };
      org.status = status;
    }

    org.updatedAt = new Date();
    await org.save();

    await AuditService.log(
      'UPDATE',
      'Organization',
      org._id.toString(),
      user,
      changes,
      `Organización ${org.name} actualizada`,
      req
    );

    logger.info('Organization updated', { orgId: org._id });
    res.json(org);
  } catch (error) {
    logger.error('Update organization error:', { error: error.message });
    res.status(400).json({ error: 'Error al actualizar organización' });
  }
}

export async function deleteOrganization(req, res) {
  try {
    const { orgId } = req.params;
    const user = req.user;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    await Organization.deleteOne({ _id: orgId });

    await AuditService.log(
      'DELETE',
      'Organization',
      orgId,
      user,
      { name: org.name, plan: org.plan },
      `Organización ${org.name} eliminada`,
      req
    );

    logger.info('Organization deleted', { orgId });
    res.json({ message: 'Organización eliminada' });
  } catch (error) {
    logger.error('Delete organization error:', { error: error.message });
    res.status(500).json({ error: 'Error al eliminar organización' });
  }
}

export async function getOrganizationStats(req, res) {
  try {
    const { orgId } = req.params;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    res.json({
      orgId: org._id,
      name: org.name,
      plan: org.plan,
      status: org.status,
      stats: {
        leadersCount: org.leadersCount,
        eventsCount: org.eventsCount,
        registrationsCount: org.registrationsCount
      },
      limits: {
        maxLeaders: org.maxLeaders,
        maxEvents: org.maxEvents,
        maxRegistrationsPerEvent: org.maxRegistrationsPerEvent
      },
      usage: {
        leaders: `${org.leadersCount}/${org.maxLeaders}`,
        events: `${org.eventsCount}/${org.maxEvents}`
      }
    });
  } catch (error) {
    logger.error('Get organization stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas de la organización' });
  }
}
