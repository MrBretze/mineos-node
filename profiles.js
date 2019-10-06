var async = require('async');
var path = require('path');
var fs = require('fs-extra');
var urlExists = require('url-exists');

function profile_template() {
  return {
    id: null,
    time: null,
    releaseTime: null,
    type: null, // release, snapshot, old_version
    group: null, //mojang, ftb, ftb_third_party, pocketmine, etc.
    webui_desc: null,
    weight: 0,
    downloaded: false,
    filename: null, // minecraft_server.1.8.8.jar
    version: null // 1.8.8,
  }
}

exports.profile_manifests = {
  mojang: {
    name: "Mojang Official Minecraft Jars",
    request_args: {
      url: 'https://launchermeta.mojang.com/mc/game/version_manifest.json',
      json: true
    },
    handler: function(profile_dir, body, callback) {
      var request = require('request');
      var p = [];

      var q = async.queue(function(obj, cb) {
        async.waterfall([
          async.apply(request, obj.url),
            function(response, body, inner_cb) {
              inner_cb(response.statusCode != 200, body)
            },
            function(body, inner_cb) {
              var parsed = JSON.parse(body);
              for (var idx in p)
                if (p[idx]['id'] == obj['id'])
                  try {
                    p[idx]['url'] = parsed['downloads']['server']['url'];
                  } catch (e) {}
              inner_cb();
            }
        ])
        cb();
      }, 2);

      q.pause();

      try { // BEGIN PARSING LOGIC
        for (var index in body.versions) {
          var item = new profile_template();
          var ref_obj = body.versions[index];

          if (ref_obj['id'] != 1.1 && ref_obj['id'] != 1.0)
          {
            item['id'] = ref_obj['id'];
            item['time'] = ref_obj['time'];
            item['releaseTime'] = ref_obj['releaseTime'];
            item['group'] = 'mojang';
            item['webui_desc'] = 'Official Mojang Jar';
            item['weight'] = 0;
            item['filename'] = 'minecraft_server.{0}.jar'.format(ref_obj['id']);
            item['downloaded'] = fs.existsSync(path.join(profile_dir, item.id, item.filename));
            item['version'] = ref_obj['id'];
            item['release_version'] = ref_obj['id'];
            
            if (ref_obj['id'] == '1.2.3' || ref_obj['id'] == '1.2.2' || ref_obj['id'] == '1.2.1')
            {
              item['url'] = 'http://assets.minecraft.net/1_2/minecraft_server.jar';
            } else {
              item['url'] = 'https://s3.amazonaws.com/Minecraft.Download/versions/{0}/minecraft_server.{0}.jar'.format(item.version);
            }
            

            switch (ref_obj['type']) {
              case 'release':
                item['type'] = ref_obj['type'];
                q.push({
                  id: item['id'],
                  url: ref_obj.url
                });
                p.push(item);
                break;
              case 'snapshot':
                item['type'] = ref_obj['type'];
                q.push({
                  id: item['id'],
                  url: ref_obj.url
                });
                p.push(item);
                break;
              default:
                item['type'] = 'old_version'; //old_alpha, old_beta
                //q.push({ id: item['id'], url: ref_obj.url });
                break;
            }
          }
          //p.push(item);
        }
      } catch (e) {}

      q.resume();
      q.drain = function() {
        callback(null, p);
      }
    }, //end handler
    postdownload: function(profile_dir, dest_filepath, callback) {
      callback();
    }
  },
  craftbukkit: {
    name: 'CraftBukkit',
    request_args: {
      url: 'https://mcmirror.io/api/list/craftbukkit',
      json: true
    },
    handler: function(profile_dir, body, callback) {
      var p = [];

      try {
        for (var index in body) {
          var filename = body[index];

          var item = new profile_template();
          var mc_version = filename.split('-')[1];

          item['time'] = new Date().getTime();

          var date = '';

          try {
            var dateTimeSplit = filename.split('-')[3];
            var years = dateTimeSplit.substr(0, 4);
            var mounth = dateTimeSplit.substr(4, 2);
            var day = dateTimeSplit.substr(6, 7);

            date = '' + years + '-' + mounth + '-' + day + '';

          } catch (e) {
            date = new Date().toISOString().split('T')[0];
          }

          item['id'] = 'CraftBukkit-{0}-({1})'.format(mc_version, date);
          item['releaseTime'] = new Date(date).getTime();
          item['type'] = 'release';
          item['group'] = 'craftbukkit';
          item['webui_desc'] = 'CraftBukkit for Minecraft: {0}'.format(mc_version);
          item['weight'] = 5;
          item['filename'] = filename;
          item['downloaded'] = fs.existsSync(path.join(profile_dir, item.id, item.filename));;
          item['version'] = 1.0;
          item['release_version'] = mc_version;
          item['url'] = 'https://mcmirror.io/files/CraftBukkit/{0}'.format(filename);
          p.push(item);
        }

      } catch (e) {
        console.log(e);
      }

      callback(null, p);
    },
    postdownload: function (profile_dir, dest_filepath, callback) {
      callback();
    } //end handler
  },
  paperspigot114: {
    name: 'PaperSpigot-1.14',
    request_args: {
      url: 'https://papermc.io/ci/job/Paper-1.14/api/json',
      json: true
    },
    handler: function(profile_dir, body, callback) {
      var p = []

      for(var index in body.builds)
      {
        var paperbuild = body.builds[index];
        var buildNumber = paperbuild["number"];

        var url = "https://papermc.io/ci/job/Paper-1.14/{0}/artifact/paperclip-{0}.jar".format(buildNumber).trim();
  
        var item = new profile_template();

        item['id'] = 'PaperSpigot-{0}'.format(buildNumber).trim();
        item['time'] = new Date().getTime();
        item['releaseTime'] = new Date().getTime();
        item['type'] = 'release';
        item['group'] = 'PaperSpigot';
        item['webui_desc'] = "PaperSpigot for Minecraft 1.14.X";
        item['weight'] = 0;
        item['filename'] = 'paperclip-{0}.jar'.format(buildNumber);
        item['downloaded'] = fs.existsSync(path.join(profile_dir, item.id, item.filename));
        item['version'] = buildNumber;
        item['release_version'] = '';
        item['url'] = url;

        p.push(JSON.parse(JSON.stringify(item)));
      }

      callback(null, p);
    },
    postdownload: function (profile_dir, dest_filepath, callback) {
      callback();
    } //end handler
  },
  spigot: {
    name: 'Spigot',
    request_args: {
      url: 'https://mcmirror.io/api/list/spigot',
      json: true
    },
    handler: function(profile_dir, body, callback) {
      var p = [];

      try {
        for (var index in body) {
          var filename = body[index];

          var item = new profile_template();
          var mc_version = filename.split('-')[1];

          item['time'] = new Date().getTime();

          var date = '';

          try {
            var dateTimeSplit = filename.split('-')[3];
            var years = dateTimeSplit.substr(0, 4);
            var mounth = dateTimeSplit.substr(4, 2);
            var day = dateTimeSplit.substr(6, 7);

            date = '' + years + '-' + mounth + '-' + day + '';

          } catch (e) {
            date = new Date().toISOString().split('T')[0];
          }

          item['id'] = 'Spigot-{0}-({1})'.format(mc_version, date);
          item['releaseTime'] = new Date(date).getTime();
          item['type'] = 'release';
          item['group'] = 'spigot';
          item['webui_desc'] = 'Spigot for Minecraft: {0}'.format(mc_version);
          item['weight'] = 5;
          item['filename'] = filename;
          item['downloaded'] = fs.existsSync(path.join(profile_dir, item.id, item.filename));;
          item['version'] = 1.0;
          item['release_version'] = mc_version;
          item['url'] = 'https://mcmirror.io/files/Spigot/{0}'.format(filename);
          p.push(item);
        }
      } catch (e) {
        console.log(e);
      }

      callback(null, p);
    },
    postdownload: function (profile_dir, dest_filepath, callback) {
      callback();
    } //end handler
  },
  bungeecord: {
    name: 'BungeeCord',
    request_args: {
      url: 'http://ci.md-5.net/job/BungeeCord/rssAll',
      json: false
    },
    handler: function(profile_dir, body, callback) {
      var p = [];

      try {
        var xml_parser = require('xml2js');

        xml_parser.parseString(body, function(inner_err, result) {
          try {
            var packs = result['feed']['entry'];

            for (var index in packs) {
              var item = new profile_template();
              var ref_obj = packs[index];

              item['version'] = packs[index]['id'][0].split(':').slice(-1)[0];
              item['group'] = 'bungeecord';
              item['type'] = 'release';
              item['id'] = 'BungeeCord-{0}'.format(item.version);
              item['webui_desc'] = packs[index]['title'][0];
              item['weight'] = 5;
              item['filename'] = 'BungeeCord-{0}.jar'.format(item.version);
              item['downloaded'] = fs.existsSync(path.join(profile_dir, item.id, item.filename));
              item['url'] = 'http://ci.md-5.net/job/BungeeCord/{0}/artifact/bootstrap/target/BungeeCord.jar'.format(item.version);
              p.push(item);
            }
            callback(err || inner_err, p);
          } catch (e) {}
        })

      } catch (e) {
        console.log(e)
      }

      callback(null, p);
    },
    postdownload: function (profile_dir, dest_filepath, callback) {
      callback();
    } //end handler
  }
};
