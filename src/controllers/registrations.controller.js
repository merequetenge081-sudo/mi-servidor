
export async function fixNames(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { eventId } = req.body;
    
    let query = { organizationId: orgId };
    if (eventId) query.eventId = eventId;

    const registrations = await Registration.find(query);
    let updatedCount = 0;

    for (let reg of registrations) {
      let f = (reg.firstName || '').trim();
      let l = (reg.lastName || '').trim();

      const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      const deduct = (s) => {
          let p = s.split(' ').filter(Boolean);
          if (p.length === 2 && p[0].toLowerCase() === p[1].toLowerCase()) return p[0];
          return s;
      };

      let newF = deduct(titleCase(f));
      let newL = deduct(titleCase(l));

      if (newF && newL && newF.toLowerCase() === newL.toLowerCase()) {
          newL = ''; 
      } else if (newL && newF.toLowerCase().includes(newL.toLowerCase().split(' ')[0]) && newF.length > newL.length) {
          newL = '';
      }

      if (f !== newF || l !== newL) {
          reg.firstName = newF;
          reg.lastName = newL;
          await reg.save();
          updatedCount++;
      }
    }

    if(updatedCount > 0) {
        await AuditService.log('registrations_fix_names', 'ALL', req.user._id, { status: 'success', updatedCount, eventId: eventId || 'all' }, req);
    }

    res.json({ success: true, message: 'Se han corregido ' + updatedCount + ' registros con exito.', updated: updatedCount });
  } catch (error) {
    logger.error('[RegistrationsController] Error fixing names: ' + error.message);
    res.status(500).json({ error: 'Error al corregir nombres' });
  }
}

