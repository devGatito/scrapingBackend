import { expect } from 'chai';
import { WebScraperService } from '../src/services/web-scraper';

describe('WebScraperService', () => {
  let scraper: WebScraperService;

  beforeEach(() => {
    scraper = new WebScraperService();
  });

  describe('generateRandomIp', () => {
    it('should generate a valid IP address', () => {
      const ip = (scraper as any).generateRandomIp();
      const parts = ip.split('.').map(Number);
      
      expect(parts).to.have.lengthOf(4);
      parts.forEach(part => {
        expect(part).to.be.at.least(1);
        expect(part).to.be.at.most(255);
      });
    });
  });

  describe('getRandomUserAgent', () => {
    it('should return a non-empty string', () => {
      const userAgent = (scraper as any).getRandomUserAgent();
      expect(userAgent).to.be.a('string');
      expect(userAgent).to.not.be.empty;
    });
  });
});
