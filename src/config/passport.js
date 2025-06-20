import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import config from './config.js';
import { tokenTypes } from './tokens.js';
import { User } from '../models/index.js';
import Roles from './enums/roles.enum.js';
import Admin from '../models/admin.model.js';

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    // if (payload.type !== tokenTypes.ACCESS) {
    //   throw new Error('Invalid token type');
    // }
    let user;
    switch (payload.role) {
      case Roles.SUPER_ADMIN:
        user = await SuperAdmin.findById(payload.id);
        break;
      // todo fix the model
      case Roles.SUPERVISOR:
        user = await SuperAdmin.findById(payload.id);
        break;
      case Roles.ADMIN:
        user = await Admin.findById(payload.id);
        break;
      default:
        return done(null, false);
    }
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

export { jwtStrategy };
